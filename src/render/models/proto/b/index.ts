/**
 * Vorschlag B "Gezeichnet / Inked comic": Schuetze und Panzer der Korvat als Prototyp.
 * Proposal B "Gezeichnet / Inked comic": Korvat rifleman and tank as a prototype.
 *
 * Das Spiel bleibt unberuehrt: unitGeometry() liefert weiter die bisherigen Modelle. protoUnit() baut daneben
 * - die Geometrie mit uv (figure.ts, tank.ts), auf die Groesse des bisherigen Modells gebracht,
 * - die Tuschegeometrie aus Umriss und Knickkanten (ink.ts),
 * - Umgebungsverdeckung je Ecke (ao.ts),
 * - zwei im Code gezeichnete Texturen (atlas.ts) und das erweiterte Toon-Material (material.ts).
 * The game stays untouched: unitGeometry() keeps returning the current models. Next to it protoUnit() builds
 * - the geometry with uv (figure.ts, tank.ts), brought to the size of the current model,
 * - the ink geometry from silhouette and crease edges (ink.ts),
 * - ambient occlusion per vertex (ao.ts),
 * - two textures drawn in code (atlas.ts) and the extended toon material (material.ts).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { unitGeometry } from '../../index';
import { scaleWithTurrets, splitTurrets } from '../../kit';
import { bakeAO } from './ao';
import { Painter, type AtlasTextures } from './atlas';
import { figureLayout, rifleman } from './figure';
import { paintFigure } from './figurePaint';
import { inkGeometry } from './ink';
import { comicMaterial } from './material';
import { tankB, tankLayout } from './tank';
import { paintTank } from './tankPaint';
import { subdivide, type AtlasLayout } from './uvkit';

export type ProtoType = 'infantry' | 'tank';
/** Hoehe des Schuetzen (bisher 0.50; das bisherige Modell ist breiter, der Kopf groesser) / rifleman height (0.50 before; the current model is wider, its head larger) */
export const FIGURE_HEIGHT = 0.62;

export interface ProtoPart {
  fill: THREE.BufferGeometry;
  ink: THREE.BufferGeometry;
  /** Drehpunkt eines Turms (fehlt bei der Wanne) / pivot of a turret (absent for the hull) */
  pivot?: THREE.Vector3;
}
export interface ProtoGeometry {
  parts: ProtoPart[];
  layout: AtlasLayout;
  /** Dreiecke der Flaechen / der Tusche (Umriss + Innenlinien) / triangles of the fill / of the ink (silhouette + inner lines) */
  triangles: number;
  inkTriangles: number;
  creases: number;
  ms: { geometry: number; ink: number; ao: number };
}

/** Rohgeometrie ohne Nachbearbeitung (auch fuer Tests, ohne DOM) / raw geometry without post-processing (also for tests, no DOM) */
export function protoRaw(type: ProtoType, faction: FactionId, low = false): { geometry: THREE.BufferGeometry; layout: AtlasLayout } {
  const layout = type === 'tank' ? tankLayout() : figureLayout();
  const b = type === 'tank' ? tankB(faction, layout, low) : rifleman(faction, layout, low);
  return { geometry: b.build(), layout };
}

/** Geometrie, Tusche und Verdeckung; Groesse wie das bisherige Modell / geometry, ink and occlusion; sized like the current model */
export function protoGeometry(type: ProtoType, faction: FactionId, low = false): ProtoGeometry {
  let t0 = performance.now();
  const { geometry: raw, layout } = protoRaw(type, faction, low);
  // gleiche Hoehe wie das bisherige Modell, Grundflaeche innerhalb der Kachel / same height as the current model, footprint inside the tile
  const ref = unitGeometry(type, faction, null);
  if (!ref.boundingBox) ref.computeBoundingBox();
  const bb = raw.boundingBox!;
  const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  // Schuetze: schlanker als bisher, deshalb bis zur erlaubten Hoehe unter dem Lebensbalken (MAX_H in models/index.ts)
  // rifleman: slimmer than before, hence up to the allowed height below the HP badge (MAX_H in models/index.ts)
  const target = type === 'infantry' ? FIGURE_HEIGHT : ref.boundingBox!.max.y;
  const s = Math.min(target / bb.max.y, 0.45 / ext);
  scaleWithTurrets(raw, s, s, s);
  raw.computeBoundingBox();
  raw.name = `protoB|${type}|${faction}${low ? '|low' : ''}|raw`;
  const msGeo = performance.now() - t0;
  t0 = performance.now();
  // Tusche aus der ungeteilten Geometrie / ink from the unsubdivided geometry
  const rawSplit = splitTurrets(raw);
  const inks = rawSplit ? [inkGeometry(rawSplit.hull), ...rawSplit.turrets.map((t) => inkGeometry(t.geometry))] : [inkGeometry(raw)];
  const msInk = performance.now() - t0;
  t0 = performance.now();
  // grosse Platten teilen, dann Verdeckung je Ecke / split large plates, then occlusion per vertex
  // niedrige Qualitaet: groebere Teilung (die Verdeckung wird entsprechend groeber) / low quality: coarser split (the occlusion gets coarser accordingly)
  const fill = bakeAO(subdivide(raw, (type === 'tank' ? 0.085 : 0.05) * (low ? 2 : 1)), { voxel: type === 'tank' ? 0.0065 : 0.005, rays: low ? 14 : 24 });
  fill.name = `protoB|${type}|${faction}${low ? '|low' : ''}`;
  const msAo = performance.now() - t0;
  const split = splitTurrets(fill);
  const parts: ProtoPart[] = split
    ? [{ fill: split.hull, ink: inks[0] }, ...split.turrets.map((t, i) => ({ fill: t.geometry, ink: inks[i + 1], pivot: t.pivot }))]
    : [{ fill, ink: inks[0] }];
  return {
    parts, layout,
    triangles: fill.getAttribute('position').count / 3,
    inkTriangles: inks.reduce((n, g) => n + g.index!.count / 3, 0),
    creases: inks.reduce((n, g) => n + (g.userData.creases as number), 0),
    ms: { geometry: msGeo, ink: msInk, ao: msAo },
  };
}

/** Texturen der Einheit zeichnen (braucht DOM) / draw the unit's textures (needs the DOM) */
export function protoTextures(type: ProtoType, faction: FactionId, layout: AtlasLayout, size = 1024): AtlasTextures {
  const p = new Painter(layout, size);
  if (type === 'tank') paintTank(p, faction);
  else paintFigure(p, faction);
  return p.finish();
}

export interface ProtoUnit extends ProtoGeometry {
  textures: AtlasTextures;
  material: THREE.MeshToonMaterial;
}

/** Vollstaendiger Prototyp einer Einheit / complete prototype of one unit */
export function protoUnit(type: ProtoType, faction: FactionId, o: { size?: number; low?: boolean } = {}): ProtoUnit {
  const g = protoGeometry(type, faction, o.low);
  const textures = protoTextures(type, faction, g.layout, o.size ?? 1024);
  return { ...g, textures, material: comicMaterial(textures) };
}
