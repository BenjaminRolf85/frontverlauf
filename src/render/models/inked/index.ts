/**
 * Gezeichnete Einheiten ("Gezeichnet / Inked"): der Stil des Spiels fuer Einheiten.
 * Inked units ("Gezeichnet / Inked"): the game's style for units.
 *
 * INKED verzeichnet die umgebauten Einheitentypen. unitGeometry() (models/index.ts) fragt hier nach: ist ein Typ fuer
 * die Fraktion verzeichnet, liefert buildInked() seine Geometrie, sonst bleibt es beim bisherigen Modell. Beide Arten
 * stehen nebeneinander auf dem Brett, bis alle Typen umgebaut sind.
 * Eine gezeichnete Geometrie traegt position, normal, uv, color, fx (Glanz, Verdeckung) und in userData:
 * inked = { atlas }, inkSrc = Rohgeometrie fuer die Tusche, turrets, finishScale. Material und Tuschelinie waehlt
 * render/unitDraw.ts daraus.
 * INKED lists the converted unit types. unitGeometry() (models/index.ts) asks here: if a type is listed for the
 * faction, buildInked() returns its geometry, otherwise the previous model stays. Both kinds stand side by side on
 * the board until every type is converted.
 * An inked geometry carries position, normal, uv, color, fx (gloss, occlusion) and in userData:
 * inked = { atlas }, inkSrc = raw geometry for the ink, turrets, finishScale. render/unitDraw.ts picks material and
 * ink line from that.
 */
import * as THREE from 'three';
import type { FactionId, UnitTypeId } from '../../../data/balance';
import { scaleWithTurrets, splitTurrets as kitSplit, type TurretSplit } from '../kit';
import { bakeAO } from './ao';
import { ATLAS_SIZE, atlasDef, atlasIds, atlasTextures, defineAtlas, releaseAtlases } from './atlas';
import { figures } from './groups/figures';
import { naval } from './groups/naval';
import { vehicles } from './groups/vehicles';
import type { InkedGroup, InkedType } from './types';
import { subdivide } from './uvkit';
export type { InkedGroup, InkedType } from './types';

/** Hoechste Modellhoehe unter dem Lebensbalken und groesste Ausdehnung auf der Kachel (wie finishUnit) / highest model point below the HP badge and largest extent on the tile (as finishUnit) */
export const INKED_MAX_H = 0.62;
export const INKED_MAX_EXT = 0.45;

/** Gruppen der Einfuehrung, je eine Datei unter groups/ / rollout groups, one file each under groups/ */
const GROUPS: InkedGroup[] = [figures, vehicles, naval];

let defined = false;
/** Atlanten aller Gruppen anlegen (einmal) / define the atlases of all groups (once) */
export function defineAtlases(): void {
  if (defined) return;
  defined = true;
  for (const g of GROUPS) for (const [id, cells] of g.atlases()) defineAtlas(id, cells);
}

/** Umgebaute Typen aller Gruppen / converted types of all groups */
export const INKED: Partial<Record<UnitTypeId, InkedType>> = Object.assign({}, ...GROUPS.map((g) => g.types));

let enabled = true;
/** Gezeichnete Einheiten abschalten: dann liefert unitGeometry() ueberall die bisherigen Modelle (Vergleich, Introfilm) / switch inked units off: unitGeometry() then returns the previous models everywhere (comparison, intro film) */
export function setInkedUnits(on: boolean): void { enabled = on; }
export function inkedUnitsEnabled(): boolean { return enabled; }

/** Eintrag fuer Typ und Fraktion oder null / entry for type and faction or null */
export function inkedType(type: UnitTypeId, faction: FactionId): InkedType | null {
  const t = INKED[type];
  if (!enabled || !t || (t.factions && !t.factions.includes(faction))) return null;
  return t;
}

/** Messwerte des letzten Aufbaus (Vorschau) / measurements of the last build (preview) */
export const lastBuild = { ms: { geometry: 0, ao: 0 } };

/**
 * Geometrie einer gezeichneten Einheit. Laeuft im Detailbereich von unitGeometry() (withDetail): fine() unterscheidet
 * hohe und niedrige Qualitaet. hoch: grosse Platten werden fuer die Verdeckung unterteilt; niedrig: keine Unterteilung,
 * weniger Strahlen.
 * Geometry of an inked unit. Runs inside unitGeometry()'s detail scope (withDetail): fine() tells high from low quality.
 * high: large plates are subdivided for the occlusion; low: no subdivision, fewer rays.
 */
export function buildInked(type: UnitTypeId, faction: FactionId, hi: boolean): THREE.BufferGeometry {
  const t = INKED[type]!;
  defineAtlases();
  let t0 = performance.now();
  const raw = t.build(faction, atlasDef(t.atlas).layout).build();
  // auf Kachel und Hoehe begrenzen; die Modelle sind in Endgroesse gebaut / limit to tile and height; the models are built at final size
  const bb = raw.boundingBox!;
  const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  const s = Math.min(1, INKED_MAX_EXT / ext, INKED_MAX_H / bb.max.y);
  if (s < 0.999) scaleWithTurrets(raw, s, s, s);
  raw.computeBoundingBox();
  raw.computeBoundingSphere();
  lastBuild.ms.geometry = performance.now() - t0;
  t0 = performance.now();
  const fill = hi ? subdivide(raw, t.maxEdge ?? 0.05) : shareAttributes(raw);
  bakeAO(fill, { voxel: (t.voxel ?? 0.005) * (hi ? 1 : 1.5), rays: hi ? 24 : 10, reach: 0.085 });
  // fx der Flaeche: (Glanz, Verdeckung); die Rohgeometrie behaelt (Glanz, Knick) fuer die Tusche
  // fx of the fill: (gloss, occlusion); the raw geometry keeps (gloss, crease) for the ink
  const src = fill.getAttribute('fx') as THREE.BufferAttribute, ao = fill.getAttribute('ao') as THREE.BufferAttribute;
  const fx = new Float32Array(src.count * 2);
  for (let i = 0; i < src.count; i++) { fx[i * 2] = src.getX(i); fx[i * 2 + 1] = ao.getX(i); }
  fill.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
  fill.deleteAttribute('ao');
  lastBuild.ms.ao = performance.now() - t0;
  fill.userData = { ...fill.userData, turrets: raw.userData.turrets ? fill.userData.turrets : undefined, inked: { atlas: t.atlas, creases: hi }, inkSrc: raw, finishScale: s };
  fill.computeBoundingBox();
  fill.computeBoundingSphere();
  return fill;
}

/** Neue Geometrie mit denselben Attributpuffern (niedrige Qualitaet: keine Unterteilung) / new geometry sharing the attribute buffers (low quality: no subdivision) */
function shareAttributes(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) out.setAttribute(name, g.getAttribute(name));
  out.userData = { ...g.userData };
  return out;
}

const splitDone = new WeakSet<THREE.BufferGeometry>();
/**
 * splitTurrets fuer beide Arten: bei gezeichneten Einheiten bekommen Wanne und Tuerme ihre eigene Rohgeometrie fuer die
 * Tusche mit (dieselbe Aufteilung der Rohgeometrie).
 * splitTurrets for both kinds: for inked units hull and turrets receive their own raw geometry for the ink (the same
 * split of the raw geometry).
 */
export function splitTurrets(g: THREE.BufferGeometry): TurretSplit | null {
  const split = kitSplit(g);
  const raw = g.userData.inkSrc as THREE.BufferGeometry | undefined;
  if (!split || !raw || splitDone.has(g)) return split;
  splitDone.add(g);
  const rs = kitSplit(raw);
  if (!rs) return split;
  split.hull.userData = { ...split.hull.userData, inkSrc: rs.hull };
  split.turrets.forEach((t, i) => { t.geometry.userData = { inked: g.userData.inked, unitGlow: g.userData.unitGlow, inkSrc: rs.turrets[i].geometry }; });
  return split;
}

/**
 * Texturen der Atlanten schon beim Laden anlegen: das Zeichnen laeuft dann verteilt ueber die ersten Bilder, nicht
 * mitten im Spiel.
 * Create the atlas textures at load time already: painting then runs spread over the first frames, not in the middle
 * of play.
 */
export function warmInked(quality: keyof typeof ATLAS_SIZE): void {
  defineAtlases();
  for (const id of atlasIds()) atlasTextures(id, ATLAS_SIZE[quality]);
  // die andere Groesse belegt keinen Grafikspeicher mehr / the other size no longer occupies GPU memory
  releaseAtlases(ATLAS_SIZE[quality]);
}
