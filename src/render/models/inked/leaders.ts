/**
 * Gezeichnete Anfuehrer: die acht Heldenbuesten (Kopf, Kopfbedeckung, Schultern, Brust bis zum Brustbein).
 * Inked leaders: the eight hero busts (head, headgear, shoulders, chest down to the sternum).
 *
 * Blick +z, Ursprung unten mittig, etwa 1.0 hoch und 0.9 breit, vier Stimmungen. Jede Bueste folgt dem Vertrag der
 * gezeichneten Einheiten (buildInked): position, normal, uv, color, fx (Glanz, Verdeckung), userData.inked = { atlas },
 * userData.inkSrc = Rohgeometrie fuer die Tusche; leuchtende Teile tragen das Attribut glow und userData.unitGlow.
 * render/unitDraw.ts zeichnet sie deshalb ohne Sonderfall, der Filmexport ebenso.
 * Facing +z, origin bottom centre, about 1.0 tall and 0.9 wide, four moods. Every bust follows the contract of the
 * inked units (buildInked): position, normal, uv, color, fx (gloss, occlusion), userData.inked = { atlas },
 * userData.inkSrc = raw geometry for the ink; glowing parts carry the attribute glow and userData.unitGlow.
 * render/unitDraw.ts therefore draws them without a special case, and so does the film export.
 *
 * Atlanten: je Anfuehrer und Stimmung EIN Heldenatlas 'leader-<fraktion>-<stimmung>' (dieselbe Aufteilung fuer alle
 * Stimmungen eines Anfuehrers, nur das Gesicht ist anders gezeichnet). Heldenatlanten sind 2048 (hoch) bzw. 1024
 * (niedrig) Pixel gross, zaehlen nicht gegen die Grenze des Bretts (MAX_ATLASES) und entstehen erst, wenn eine Bueste
 * wirklich gezeichnet wird: nur der Film und die Vorschau tun das, das Spiel nie (es zeigt die Portraetbilder).
 * Atlases: ONE hero atlas 'leader-<faction>-<mood>' per leader and mood (the same layout for all moods of a leader,
 * only the face is drawn differently). Hero atlases are 2048 (high) or 1024 (low) pixels, do not count against the
 * board's limit (MAX_ATLASES) and only come into being when a bust is really drawn: only the film and the preview
 * do that, never the game (it shows the portrait pictures).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { col, type ColorLike } from '../kit';
import type { LeaderMood } from '../leaders';
import { bakeAO } from './ao';
import { atlasDef, defineAtlas, hasAtlas, type Cell } from './atlas';
import { alvenia } from './leaderAlvenia';
import { dravon } from './leaderDravon';
import { korvat } from './leaderKorvat';
import { meridon } from './leaderMeridon';
import { velkar } from './leaderVelkar';
import { zyrr } from './leaderZyrr';
import { moodArt, type MoodArt } from './leaderPaint';
import { AtlasLayout, UvBuilder } from './uvkit';

/** Eine Bueste: Zellen ihres Atlas und Aufbau, beide je Stimmung / one bust: the cells of its atlas and its build, both per mood */
export interface LeaderDef {
  cells: (m: MoodArt) => Cell[];
  build: (b: UvBuilder, A: AtlasLayout, m: MoodArt) => void;
  /** Vertexfarben, die selbst leuchten (Augen, Lampen, Glut) / vertex colours that glow by themselves (eyes, lamps, embers) */
  glow?: ColorLike[];
  /** Seite der hochgezogenen Braue beim Grinsen / side of the raised brow when smug */
  side?: 1 | -1;
}

const DEFS: Partial<Record<FactionId, LeaderDef>> = { korvat, dravon, alvenia, meridon, velkar, zyrr };

/** Gibt es die gezeichnete Bueste der Fraktion? / does the inked bust of the faction exist? */
export function hasInkedLeader(f: FactionId): boolean { return !!DEFS[f]; }
/** Name des Heldenatlas einer Bueste / name of a bust's hero atlas */
export function leaderAtlasId(f: FactionId, mood: LeaderMood): string { return `leader-${f}-${mood}`; }
/** Heldenatlas einer Bueste anlegen (einmal); zeichnet noch nichts / define a bust's hero atlas (once); paints nothing yet */
export function defineLeaderAtlas(f: FactionId, mood: LeaderMood): string {
  const id = leaderAtlasId(f, mood), def = DEFS[f]!;
  if (!hasAtlas(id)) defineAtlas(id, def.cells(moodArt(mood, def.side ?? 1)), { hero: true });
  return id;
}

/** Verdeckung: Voxelgroesse und Reichweite im Massstab der Bueste / occlusion: voxel size and reach at the bust's scale */
const AO = { voxel: 0.0075, reach: 0.13 };

/**
 * Geometrie einer gezeichneten Bueste. Laeuft im Detailbereich von leaderGeometry() (withDetail): fine() unterscheidet
 * hohe und niedrige Qualitaet. Die Buesten sind fein genug gebaut, es wird nicht unterteilt.
 * Geometry of an inked bust. Runs inside leaderGeometry()'s detail scope (withDetail): fine() tells high from low
 * quality. The busts are built finely enough, nothing is subdivided.
 */
export function buildLeader(f: FactionId, mood: LeaderMood, hi: boolean): THREE.BufferGeometry {
  const def = DEFS[f]!;
  const atlas = defineLeaderAtlas(f, mood);
  const A = atlasDef(atlas).layout;
  const b = new UvBuilder(A.get('blank'));
  def.build(b, A, moodArt(mood, def.side ?? 1));
  const raw = b.build();
  const fill = new THREE.BufferGeometry();
  for (const name of Object.keys(raw.attributes)) fill.setAttribute(name, raw.getAttribute(name));
  bakeAO(fill, { voxel: AO.voxel * (hi ? 1 : 1.5), rays: hi ? 24 : 10, reach: AO.reach, ground: false });
  // fx der Flaeche: (Glanz, Verdeckung); die Rohgeometrie behaelt (Glanz, Knick) fuer die Tusche
  // fx of the fill: (gloss, occlusion); the raw geometry keeps (gloss, crease) for the ink
  const src = raw.getAttribute('fx') as THREE.BufferAttribute, ao = fill.getAttribute('ao') as THREE.BufferAttribute;
  const fx = new Float32Array(src.count * 2);
  for (let i = 0; i < src.count; i++) { fx[i * 2] = src.getX(i); fx[i * 2 + 1] = ao.getX(i); }
  fill.setAttribute('fx', new THREE.BufferAttribute(fx, 2));
  fill.deleteAttribute('ao');
  fill.userData = { inked: { atlas, creases: hi }, inkSrc: raw, finishScale: 1, leader: { faction: f, mood } };
  if (def.glow?.length) {
    // Leuchtmaske aus den Vertexfarben (wie withGlow bei den Einheiten) / glow mask from the vertex colours (as withGlow for the units)
    const keys = def.glow.map(col), c = fill.getAttribute('color') as THREE.BufferAttribute;
    const glow = new Float32Array(c.count * 2);
    for (let i = 0; i < c.count; i++) {
      const r = c.getX(i), g = c.getY(i), bl = c.getZ(i);
      if (keys.some((k) => Math.abs(r - k.r) + Math.abs(g - k.g) + Math.abs(bl - k.b) < 0.012)) glow[i * 2] = 1;
    }
    fill.setAttribute('glow', new THREE.BufferAttribute(glow, 2));
    fill.userData.unitGlow = true;
  }
  fill.computeBoundingBox();
  fill.computeBoundingSphere();
  return fill;
}
