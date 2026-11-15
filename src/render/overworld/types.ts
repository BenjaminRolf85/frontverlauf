/**
 * Gemeinsame Typen der Weltenbauer / shared types of the world builders.
 */
import * as THREE from 'three';
import type { Disc } from './disc';
import type { Clock, Look } from './kit';
import { distToPath } from './disc';
import { markerLayout, type Landmark, type P2, type Zone } from './layout';

export interface WorldCtx {
  look: Look;
  clock: Clock;
  /** wenige Deko (Handy, niedrige Qualitaet) / little decoration (phones, low quality) */
  low: boolean;
  R: number;
  /** Einsaetze dieser Welt in Spielreihenfolge (aus WORLDS) / missions of this world in play order (from WORLDS) */
  ids: readonly string[];
}

export interface WorldBuild {
  /** dreht sich beim Ziehen (Scheibe, Inhalt, Marker) / turns when dragged (disc, content, markers) */
  spin: THREE.Group;
  /** dreht nicht mit (Lichthof, Dunst) / does not turn (halo, haze) */
  fixed?: THREE.Group;
  disc: Disc;
  /** Plaetze der Einsatzmarker in Spielreihenfolge (lokal x, z) / spots of the mission markers in play order (local x, z) */
  spots: THREE.Vector2[];
  /** Animation, Zeit in Sekunden / animation, time in seconds */
  update(t: number): void;
}

/** Marker aus dem Layout als Vector2 / markers from the layout as Vector2 */
export function markerSpots(ctx: WorldCtx, landmarks: Partial<Record<Landmark, P2>>, avoid: readonly Zone[], phase = 0): THREE.Vector2[] {
  return markerLayout(ctx.ids, { R: ctx.R, landmarks, avoid, phase }).map((p) => new THREE.Vector2(p.x, p.z));
}

/** Gleichmaessig gestreute Punkte (Gitter mit Zittern) in der Scheibe / evenly scattered points (jittered grid) in the disc */
export function jitterGrid(R: number, step: number, seed: number, maxR = 0.88): THREE.Vector2[] {
  let a = seed * 9301 + 49297;
  const rnd = () => { a = (a * 9301 + 49297) % 233280; return a / 233280; };
  const out: THREE.Vector2[] = [];
  for (let x = -R; x <= R; x += step) for (let z = -R; z <= R; z += step) {
    const p = new THREE.Vector2(x + (rnd() - 0.5) * step * 0.9, z + (rnd() - 0.5) * step * 0.9);
    if (p.length() < R * maxR) out.push(p);
  }
  return out;
}

/**
 * Platzpruefung fuer Deko: frei von Zonen und vom Weg der Marker / placement check for decoration: clear of zones and
 * of the marker path.
 */
export function freeOf(zones: readonly Zone[], path: readonly THREE.Vector2[], pathGap: number) {
  return (x: number, z: number, pad = 0) => !zones.some((q) => Math.hypot(x - q.x, z - q.z) < q.r + pad) && distToPath(x, z, path) >= pathGap;
}
