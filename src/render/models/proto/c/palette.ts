/**
 * Vorschlag C: Farbpalette der modellierten Einheiten. Das Modell traegt keine Farben, nur Farbrollen (UV in eine
 * Palette, siehe tools/models/fvm/kit.py SLOTS). Hier wird die Palette je Fraktion aus den Design-Tokens gebaut, also
 * aus derselben Quelle wie die prozeduralen Modelle (look.ts). Teamfarbe wechseln = andere Palette, gleiche Geometrie.
 * Proposal C: colour palette of the modelled units. The model carries no colours, only colour roles (UV into a palette,
 * see tools/models/fvm/kit.py SLOTS). Here the palette is built per faction from the design tokens, i.e. from the same
 * source as the procedural models (look.ts). Changing the team colour = another palette, same geometry.
 */
import * as THREE from 'three';
import type { FactionId } from '../../../../data/balance';
import { mix, shade } from '../../kit';
import { look, mat } from '../../look';

/** Anzahl Palettenfelder, wie PALETTE_SIZE in kit.py / number of palette cells, as PALETTE_SIZE in kit.py */
export const PALETTE_SIZE = 32;

/** Farbrollen in Palettenreihenfolge, wie SLOTS in kit.py / colour roles in palette order, as SLOTS in kit.py */
export const SLOTS = [
  'skin', 'skinDark', 'hair', 'eyeWhite', 'ink', 'jacket', 'pants', 'helmet', 'gear', 'boots',
  'primary', 'emblem', 'canvas', 'wood', 'metal', 'metalLight', 'hull', 'hullDark', 'trim', 'rubber',
  'track', 'lamp', 'glass', 'jacketDark', 'woodDark', 'primaryDark', 'brass', 'badge', 'hullLight', 'trimDark',
] as const;
export type Slot = (typeof SLOTS)[number];

/** Farbe je Rolle fuer eine Fraktion / colour per role for a faction */
export function paletteColors(f: FactionId): THREE.Color[] {
  const L = look(f);
  const by: Record<Slot, THREE.Color> = {
    skin: mat.skin,
    skinDark: shade(mat.skin, 0.78),
    hair: shade(mat.wood, 0.5),
    eyeWhite: mat.paper,
    ink: mat.ink,
    jacket: L.jacket,
    pants: L.pants,
    helmet: L.helmet,
    gear: L.gear,
    boots: mat.dark,
    primary: L.primary,
    emblem: L.emblem,
    canvas: shade(L.secondary, 0.82),
    wood: mat.wood,
    metal: mat.metal,
    metalLight: mat.metalLight,
    hull: L.hull,
    hullDark: L.hullDark,
    trim: L.trim,
    rubber: mat.dark,
    track: mat.darkMid,
    lamp: mat.yellow,
    glass: mat.glassDark,
    jacketDark: shade(L.jacket, 0.72),
    woodDark: shade(mat.wood, 0.72),
    primaryDark: L.primaryDark,
    brass: mat.gold,
    badge: shade(L.secondary, 1.35),
    hullLight: mix(L.hull, mat.white, 0.08),
    trimDark: shade(L.trim, 0.7),
  };
  const out: THREE.Color[] = [];
  for (let i = 0; i < PALETTE_SIZE; i++) out.push(i < SLOTS.length ? by[SLOTS[i]] : mat.ink);
  return out;
}

const textures = new Map<FactionId, THREE.DataTexture>();
/** Palette als 32 x 1 Textur (128 Byte) / palette as a 32 x 1 texture (128 bytes) */
export function paletteTexture(f: FactionId): THREE.DataTexture {
  let t = textures.get(f);
  if (t) return t;
  const data = new Uint8Array(PALETTE_SIZE * 4);
  const tmp = { r: 0, g: 0, b: 0 };
  paletteColors(f).forEach((c, i) => {
    c.getRGB(tmp, THREE.SRGBColorSpace);
    data.set([Math.round(tmp.r * 255), Math.round(tmp.g * 255), Math.round(tmp.b * 255), 255], i * 4);
  });
  t = new THREE.DataTexture(data, PALETTE_SIZE, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  textures.set(f, t);
  return t;
}
