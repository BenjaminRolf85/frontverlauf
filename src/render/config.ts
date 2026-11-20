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
/** Breite der Tuschelinie in Objektkoordinaten; scenery = Baeume und Gipfel / width of the ink line in object space; scenery = trees and peaks */
export const OUTLINE = { ownUnit: 0.015, unit: 0.018, building: 0.016, scenery: 0.02, tile: 0.012, cloud: 0.02, highlight: 0.01 };
/**
 * Bodenringe der Einheiten (Radien in Feldbreiten, ausserhalb des Sockels mit Radius 0.36 plus Tuschelinie).
 * Fremde: schmaler Ring in Fraktionsfarbe mit Tuscherand. Eigene: kaum breiter, dazu ein weisser Innenring und ein
 * leichter Puls; der Ring bleibt so schmal, dass Nachbarn sich nie beruehren (2 x outer x (1 + pulse) < 1).
 * Ground rings of the units (radii in tile widths, outside the base with radius 0.36 plus its ink line).
 * Foreign: a thin ring in the faction colour with an ink rim. Own: barely wider, plus a white inner ring and a gentle
 * pulse; the ring stays slim enough that neighbours never touch (2 x outer x (1 + pulse) < 1).
 */
export const MARKER = {
  foreign: { inner: 0.4, band: 0.43, outer: 0.445 },
  own: { inner: 0.385, white: 0.407, band: 0.443, outer: 0.458 },
  /** Ausschlag und Tempo des Pulses eigener Ringe / amplitude and speed of the pulse of own rings */
  pulse: 0.04, pulseSpeed: 3.2,
  segments: 40, lift: 0.012,
};
/**
 * LP-Plakette: Mindestbreite und Innenabstand des Schilds in Canvas-Pixeln (Canvas 128 breit, Ziffern 44 hoch).
 * HP badge: minimum width and padding of the pill in canvas pixels (canvas 128 wide, digits 44 high).
 */
export const BADGE = { minPill: 72, pad: 17 };
/**
 * Besatzung: Eine Einheit auf einem Stadtfeld (auch Sendeturm, Aussenposten, Hoehle, Nachschublinie) rueckt um shift
 * Feldbreiten zur Kamera hin an die vordere Ecke und wird mit scale verkleinert gezeichnet; die Stadt dahinter bleibt
 * sichtbar. Die LP-Plakette behaelt ihre Groesse. Mit diesen Werten beruehrt der Ring keinen Nachbarring
 * (Abstand zum Nachbarn rund 0.84 > 0.458 x 1.04 + 0.458 x scale x 1.04).
 * Garrison: a unit on a city tile (also transmitter tower, outpost, burrow, supply line) moves by shift tile widths
 * towards the camera into the front corner and is drawn scaled by scale; the city behind it stays visible. The HP badge
 * keeps its size. With these values the ring touches no neighbouring ring (distance to the neighbour about 0.84 >
 * 0.458 x 1.04 + 0.458 x scale x 1.04).
 */
export const GARRISON = { shift: 0.255, scale: 0.76 };
/**
 * Stadtschild: haengt unter der vorderen Ecke des Feldes (front, zur Kamera). Steht dort ein Nachbar, weicht es an die
 * linke oder rechte vordere Kante aus (side nach vorn, across zur Seite); drop = Absenkung unter die Feldoberkante.
 * City sign: hangs below the front corner of the tile (front, towards the camera). If a neighbour stands there it moves
 * to the left or right front edge (side to the front, across sideways); drop = offset below the tile top.
 */
export const CITY_SIGN = { front: 0.72, side: 0.52, across: 0.6, drop: 0.05 };
/**
 * Tiefenmaske der Staedte (nur hohe Qualitaet): Einheiten werden nach dem Leeren des Tiefenpuffers gezeichnet und
 * uebermalten sonst auch Tuerme, die vor ihnen stehen. Die Stadt schreibt deshalb ihre Tiefe noch einmal, um push
 * Feldbreiten entlang der Blickachse nach hinten geschoben (im Bild deckungsgleich): Was mehr als push hinter einer
 * Stadtflaeche liegt (Einheit auf dem Feld dahinter), wird von ihr verdeckt; die eigene Besatzung und Markierungen auf
 * dem Stadtfeld liegen naeher und bleiben sichtbar.
 * Depth mask of the cities (high quality only): units are drawn after the depth clear and would otherwise also paint
 * over towers standing in front of them. So the city writes its depth once more, pushed back by push tile widths along
 * the view axis (congruent on screen): whatever lies more than push behind a city surface (a unit on the tile behind)
 * is hidden by it; the city's own garrison and highlights on the city tile are closer and stay visible.
 */
export const CITY_MASK = { push: 0.7 };
/** Massstab der Siedlungen der anderen Welten (Hoehle, Aussenposten, Nachschublinie) / scale of the settlements of the other worlds (burrow, outpost, supply line) */
export const SETTLEMENT_SCALE = 1.15;
/** Sonnenposition (Licht und projizierte Schatten) / sun position (light and projected shadows) */
export const SUN = { x: -9, y: 7.5, z: 6 };
export const ANIM = { move: 360, attack: 320, death: 400, rotate: 320, maxTotal: 400 };
export const CAMERA = { elevation: Math.atan(1 / Math.SQRT2), distance: 40, minZoom: 0.6, maxZoom: 4, baseView: 0.62 };
export const XR = { mapEdge: 1.2, tableHeight: 0.78, tableSize: 1.6, arDistance: 1.0, arHipHeight: 0.95 };
