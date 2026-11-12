/** Geometrische Konstanten der 3D-Darstellung / geometric constants of the 3D view */
import type { TerrainId } from '../data/balance';

export const TILE_TOP: Record<TerrainId, number> = {
  ocean: -0.16,
  shallow: -0.09,
  plain: 0,
  forest: 0,
  mountain: 0.12,
};
export const TILE_BOTTOM = -0.42;
export const SLAB_DEPTH = 0.55;
export const CLOUD_Y = 0.32;
export const OUTLINE = { ownUnit: 0.015, unit: 0.018, building: 0.016, tile: 0.012, cloud: 0.02, highlight: 0.01 };
/** Sonnenposition (Licht und projizierte Schatten) / sun position (light and projected shadows) */
export const SUN = { x: -9, y: 7.5, z: 6 };
export const ANIM = { move: 360, attack: 320, death: 400, rotate: 320, maxTotal: 400 };
export const CAMERA = { elevation: Math.atan(1 / Math.SQRT2), distance: 40, minZoom: 0.6, maxZoom: 4, baseView: 0.62 };
export const XR = { mapEdge: 1.2, tableHeight: 0.78, tableSize: 1.6, arDistance: 1.0, arHipHeight: 0.95 };
