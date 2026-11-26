/**
 * Einheiten zeichnen: EIN Weg fuer bisherige und gezeichnete Modelle, solange beide nebeneinander bestehen.
 * Drawing units: ONE path for previous and inked models while both exist side by side.
 *
 * Wer eine Einheit darstellt (Brett, Portrait, Vorschau), ruft unitOutlined() statt outlined() und unitMaterialLike()
 * statt unitMaterial(): die Geometrie sagt in userData.inked, ob sie gezeichnet ist. Gezeichnete Einheiten bekommen
 * das Comic-Material ihres Atlas (models/inked/material.ts) und die Tuschegeometrie aus Umriss und Innenlinien
 * (models/inked/ink.ts); alle anderen bleiben bei unitMaterial / unitGlowMaterial und der umgestuelpten Huelle.
 * Whoever shows a unit (board, portrait, preview) calls unitOutlined() instead of outlined() and unitMaterialLike()
 * instead of unitMaterial(): the geometry says in userData.inked whether it is inked. Inked units get the comic
 * material of their atlas (models/inked/material.ts) and the ink geometry of silhouette and inner lines
 * (models/inked/ink.ts); all others stay with unitMaterial / unitGlowMaterial and the inverted hull.
 */
import * as THREE from 'three';
import { ATMO, unitGlowMaterial } from './atmosphere';
import { getUnitQuality } from './models';
import { inkFor, inkMaterial, syncView } from './models/inked/ink';
import { comicMaterial, GLOW_UNIFORM, type InkedQuality } from './models/inked/material';
import { outlined, unitMaterial } from './toon';

export interface UnitMatOpts { transparent?: boolean; opacity?: number; dim?: boolean }

// Leuchten gezeichneter Einheiten folgt dem Tag-Nacht-Wert des Brettes / the glow of inked units follows the board's day-night value
GLOW_UNIFORM.ref = ATMO.uGlow;

/** Ist die Geometrie eine gezeichnete Einheit? / is the geometry an inked unit? */
export function isInked(g: THREE.BufferGeometry): boolean {
  return !!g.userData.inked;
}

/** Material fuer eine Einheitengeometrie (gezeichnet oder bisherig, leuchtend oder nicht) / material for a unit geometry (inked or previous, glowing or not) */
export function unitMaterialFor(g: THREE.BufferGeometry, opts: UnitMatOpts = {}): THREE.Material {
  const ink = g.userData.inked as { atlas: string } | undefined;
  if (ink) return comicMaterial(ink.atlas, getUnitQuality(), { ...opts, glow: !!g.userData.unitGlow });
  return g.userData.unitGlow ? unitGlowMaterial(opts) : unitMaterial(opts);
}

/**
 * Dieselbe Materialfamilie wie cur in einer anderen Variante (abgedunkelt, durchsichtig); null, wenn cur kein
 * Einheitenmaterial ist.
 * The same material family as cur in another variant (dimmed, transparent); null if cur is no unit material.
 */
export function unitMaterialLike(cur: THREE.Material, opts: UnitMatOpts = {}): THREE.Material | null {
  if (!cur.userData?.unitMat) return null;
  const ink = cur.userData.inked as { atlas: string; quality: InkedQuality; glow: boolean } | undefined;
  if (ink) return comicMaterial(ink.atlas, ink.quality, { ...opts, glow: ink.glow });
  return cur.userData.unitGlow ? unitGlowMaterial(opts) : unitMaterial(opts);
}

/** Einheit mit Tuschelinie wie outlined(): Gruppe aus Flaeche und Linie, userData.mesh = Flaeche / unit with ink line like outlined(): group of fill and line, userData.mesh = fill */
export function unitOutlined(g: THREE.BufferGeometry, width = 0.018, opts: UnitMatOpts = {}): THREE.Group {
  const material = unitMaterialFor(g, opts);
  if (!isInked(g)) return outlined(g, width, material);
  const grp = new THREE.Group();
  const mesh = new THREE.Mesh(g, material);
  const line = new THREE.Mesh(inkFor(g), inkMaterial(width));
  // Bildgroesse fuer die Linienbreite, je Renderer / viewport size for the line width, per renderer
  line.onBeforeRender = syncView;
  line.raycast = () => {};
  grp.add(mesh, line);
  grp.userData.mesh = mesh;
  return grp;
}
