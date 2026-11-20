/**
 * Wasser im Comic-Stil: eine durchgehende Oberflaeche ueber allen sichtbaren Wasserfeldern mit sanften Wellen,
 * gestuften Farbbaendern (Kueste tuerkis, Tiefe dunkelblau), Glitzern und Schaumkronen an der Kueste.
 * Comic-style water: one continuous surface over all visible water tiles with gentle waves,
 * stepped colour bands (turquoise coast, dark blue depth), glints and foam crests at the coast.
 */
import * as THREE from 'three';
import type { GameState, Tile } from '../core';
import { hex, semantic } from '../design/tokens';
import { TILE_BOTTOM, TILE_TOP } from './config';
import { ATMO, HAZE_GLSL } from './atmosphere';

/** Wasserkaesten liegen so tief unter der Oberflaeche / water boxes sit this far below the surface */
export const WATER_BOX_TOP = TILE_TOP.ocean - 0.035;
/** Oberflaeche liegt knapp unter der Feldoberkante (Fischschatten, Ringe bleiben sichtbar) / surface just below tile top */
const SURFACE_DROP = 0.008;
/** Hoehe am Ufer / height at the shore */
const SHORE_H = TILE_TOP.shallow;

const isWater = (terrain: string) => terrain === 'shallow' || terrain === 'ocean';
/** Annahme fuer Felder unter dem Nebel: Wasser mittlerer Tiefe und Hoehe / assumption for tiles under the fog: water of medium depth and height */
const FOG_WATER = { depth: 0.71, height: (TILE_TOP.ocean + TILE_TOP.shallow) / 2 };

/**
 * Sandbank der Standardwelt: der Wasser-Shader zeichnet am flachen Ufer einen geschwungenen Sandsaum ins Wasserfeld,
 * die Brandung folgt seinem Rand. Breite in Feldern: mittel und Ausschlag; wet = Anteil nassen Sands am Aussenrand;
 * lap = Atmen der Wasserlinie. Kostet keine Dreiecke.
 * Sand shoal of the default world: at flat shores the water shader draws a curved sand fringe into the water tile, the
 * surf follows its edge. Width in tiles: mean and swing; wet = share of wet sand at the outer rim; lap = breathing of
 * the waterline. Costs no triangles.
 */
export const SHOAL = { width: 0.085, swing: 0.06, wet: 0.38, lap: 0.007, wetTone: 0.28 };


/**
 * Hoehle: unterirdische Teiche, dunkel tuerkis mit hellem, leuchtendem Ufer; Wueste: rostrote Tuempel; sonst die
 * normalen Wasserfarben. true steht fuer die Hoehle (aeltere Aufrufe).
 * Cavern: underground pools, dark teal with a bright glowing shore; desert: rust-red pools; otherwise the normal water
 * colours. true stands for the cavern (older calls).
 */
export function setWaterTheme(theme: boolean | 'cavern' | 'desert' | null) {
  const cave = theme === true || theme === 'cavern';
  const desert = theme === 'desert';
  const m = waterMaterial(false);
  const set = (k: string, h: string) => (m.uniforms[k].value as THREE.Color).set(hex(h));
  set('uShore', cave ? semantic.cavePoolShore : desert ? semantic.desertPoolShore : semantic.waterShore);
  set('uShallow', cave ? semantic.cavePool : desert ? semantic.desertPool : semantic.terrainShallow);
  set('uOcean', cave ? semantic.cavePool : desert ? semantic.desertPool : semantic.terrainOcean);
  set('uDeep', cave ? semantic.cavePoolDeep : desert ? semantic.desertPoolDeep : semantic.waterAbyss);
  set('uGlint', cave ? semantic.caveCrystal : desert ? semantic.desertSalt : semantic.waterGlint);
  set('uFoam', cave ? semantic.cavePoolShore : desert ? semantic.desertSaltCrust : semantic.waterFoam);
  m.uniforms.uCaveGlow.value = cave ? 1 : 0;
  // Sandbank nur in der Standardwelt / sand shoal only in the default world
  m.uniforms.uShoal.value = cave || desert ? 0 : 1;
}

const materials = new Map<boolean, THREE.ShaderMaterial>();
/**
 * Gemeinsames Wassermaterial; alien = violett leuchtendes Wasser der Zyrr-Heimatwelt (Wellenkaemme ueberhell fuer den Bloom).
 * Shared water material; alien = violet glowing water of the Zyrr homeworld (wave crests over-bright for the bloom).
 */
export function waterMaterial(alien = false): THREE.ShaderMaterial {
  const cached = materials.get(alien);
  if (cached) return cached;
  const C = (h: string) => ({ value: new THREE.Color(hex(h)) });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: ATMO.uTime, uNight: ATMO.uNight, uLight: ATMO.uLight,
      uHaze: ATMO.uHaze, uHazeColor: ATMO.uHazeColor, uHazeHalf: ATMO.uHazeHalf,
      uShore: C(alien ? semantic.alienWaterShallow : semantic.waterShore), uShallow: C(alien ? semantic.alienWaterOcean : semantic.terrainShallow),
      uOcean: C(alien ? semantic.alienWaterDeep : semantic.terrainOcean), uDeep: C(alien ? semantic.alienWaterDeep : semantic.waterAbyss),
      uFoam: C(alien ? semantic.xenoGlow : semantic.waterFoam), uGlint: C(alien ? semantic.xenoAcid : semantic.waterGlint),
      uEmit: { value: alien ? 1 : 0 },
      // Sandbank am flachen Ufer (nur Standardwelt, siehe setWaterTheme) / sand shoal at flat shores (default world only, see setWaterTheme)
      uShoal: { value: alien ? 0 : 1 },
      // nasser Sand: Strandfarbe, zum dunklen Fels hin abgetoent / wet sand: beach colour toned towards the dark rock
      uSand: C(semantic.beach), uSandWet: { value: new THREE.Color(hex(semantic.beach)).lerp(new THREE.Color(hex(semantic.cliffDark)), SHOAL.wetTone) },
      uShoalShape: { value: new THREE.Vector4(SHOAL.width, SHOAL.swing, SHOAL.wet, SHOAL.lap) },
      // Hoehle: Ufer und Schaum leuchten selbst / cavern: shore and foam glow by themselves
      uCaveGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec2 water;
      attribute float shoal;
      varying vec3 vW;
      varying vec2 vWater;
      varying float vShoal;
      void main() {
        vec3 p = position;
        // sanftes Heben und Senken, am Ufer ruhig / gentle rise and fall, calm at the shore
        float calm = smoothstep(0.0, 0.25, water.y);
        p.y += sin(p.x * 2.7 + uTime * 1.1 + p.z * 1.3) * cos(p.z * 2.1 - uTime * 0.9) * 0.005 * calm;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        vWater = water;
        vShoal = shoal;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      uniform vec3 uLight;
      uniform vec3 uShore;
      uniform vec3 uShallow;
      uniform vec3 uOcean;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform vec3 uGlint;
      uniform float uCaveGlow;
      uniform float uEmit;
      uniform float uShoal;
      uniform vec3 uSand;
      uniform vec3 uSandWet;
      uniform vec4 uShoalShape;
      varying vec3 vW;
      varying vec2 vWater;
      varying float vShoal;
      ${HAZE_GLSL}
      void main() {
        float t = uTime;
        // zwei ueberlagerte, verzerrte Wellenfelder / two overlapping distorted wave fields
        float w1 = sin(vW.x * 3.1 + t * 0.9 + sin(vW.z * 2.3 + t * 0.6) * 1.2);
        float w2 = sin(vW.z * 3.7 - t * 0.8 + sin(vW.x * 1.9 - t * 0.5) * 1.1);
        float wave = (w1 + w2) * 0.5;
        float d = clamp(vWater.x + wave * 0.06, 0.0, 1.0);
        // harte Farbbaender statt Verlauf / hard colour bands instead of a gradient
        vec3 col = uShore;
        col = mix(col, uShallow, step(0.2, d));
        col = mix(col, uOcean, step(0.52, d));
        col = mix(col, uDeep, step(0.86, d));
        // helles Band auf den Wellenkaemmen / light band on the wave crests
        col = mix(col, col * 1.12 + 0.035, step(0.72, wave) * 0.7);
        col *= uLight;
        // Glitzern als kurze Striche / glints as short dashes
        float g = sin(vW.x * 11.0 + t * 1.7 + vW.z * 4.0) * sin(vW.z * 9.0 - t * 1.3 - vW.x * 3.0);
        float glint = step(0.965, g) * step(0.45, vWater.x);
        // Sandbank: geschwungener Sandsaum am flachen Ufer, die Brandung beginnt an seinem Rand
        // sand shoal: curved sand fringe at flat shores, the surf starts at its edge
        float lobes = sin(vW.x * 4.3 + sin(vW.z * 3.1) * 1.4) * 0.5 + sin(vW.z * 5.1 + sin(vW.x * 2.7) * 1.2) * 0.5;
        float sandW = max(uShoalShape.x + uShoalShape.y * lobes + uShoalShape.w * sin(t * 0.9 + vW.x * 2.0 + vW.z * 1.6), 0.0) * vShoal * uShoal;
        float onSand = 1.0 - step(sandW, vWater.y);
        // Schaum: Brandungslinie am Ufer und auflaufende Baender / foam: surf line at the shore and incoming bands
        float s = max(vWater.y - sandW, 0.0) + wave * 0.015;
        float edge = 1.0 - step(0.065 + 0.025 * sin(vW.x * 7.0 + vW.z * 5.0 + t * 1.6), s);
        float band = fract(s * 4.0 + t * 0.32);
        float ring = step(0.84, band) * (1.0 - smoothstep(0.1, 0.4, s));
        float foam = max(edge, ring);
        col = mix(col, uFoam * mix(uLight, vec3(1.0), 0.35), foam * (1.0 - uNight * 0.25));
        col += uGlint * uLight * glint * 0.45 * (1.0 - foam);
        // trockener Sand am Land, nasser Sand zur Wasserlinie / dry sand at the land, wet sand towards the waterline
        col = mix(col, mix(uSand, uSandWet, step(sandW * (1.0 - uShoalShape.z), vWater.y)) * uLight, onSand);
        // Hoehle: leuchtendes Ufer, Schaum und Glitzern (fuer den Bloom ueberhell) / cavern: glowing shore, foam and glints (over-bright for bloom)
        col += (uShore * (1.0 - step(0.2, d)) * 0.35 + uFoam * foam * 0.9 + uGlint * glint * 1.2) * uCaveGlow;
        // Alienwelt: Eigenleuchten, nachts staerker, Kaemme und Glitzer ueberhell / alien world: self glow, stronger at night, crests and glints over-bright
        col += uFoam * uEmit * (0.06 + 0.2 * uNight + 0.4 * step(0.78, wave));
        col = mix(col, uHazeColor, atmoHaze(vW));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  materials.set(alien, material);
  return material;
}

/**
 * Oberflaeche fuer alle sichtbaren Wasserfelder bauen (ein Mesh, ein Draw-Call).
 * Build the surface for all visible water tiles (one mesh, one draw call).
 * Attribut water: x = Tiefe 0..1 (weich zwischen Feldern), y = Abstand zum Ufer in Feldern.
 * Attribute water: x = depth 0..1 (smooth between tiles), y = distance to the shore in tiles.
 * Attribut shoal: 1, wo das naechste Land einen Strand hat (sandy), sonst 0; ohne sandy ueberall 0.
 * Attribute shoal: 1 where the nearest land has a beach (sandy), otherwise 0; without sandy 0 everywhere.
 */
export function buildWater(s: GameState, explored: (x: number, y: number) => boolean, detail = 5, sandy?: (land: Tile, water: Tile) => boolean): THREE.Mesh | null {
  const size = s.size, off = (size - 1) / 2;
  const clamp = (v: number) => Math.max(0, Math.min(size - 1, v));
  const T = (x: number, y: number) => s.tiles[clamp(y) * size + clamp(x)];
  // Felder unter dem Nebel zaehlen mit einem festen Mittelwert: Hoehe und Farbbaender am Nebelrand verraten so nicht,
  // ob dahinter Land, Flachwasser oder Tiefsee liegt
  // tiles under the fog count with a fixed mean value: height and colour bands at the fog edge thus do not reveal
  // whether land, shallows or deep sea lie behind it
  const known = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) known[y * size + x] = explored(x, y) ? 1 : 0;
  const hidden = (x: number, y: number) => !known[clamp(y) * size + clamp(x)];
  const height = (x: number, y: number) => { if (hidden(x, y)) return FOG_WATER.height; const t = T(x, y); return isWater(t.terrain) ? TILE_TOP[t.terrain] : SHORE_H; };
  const depth = (x: number, y: number) => { if (hidden(x, y)) return FOG_WATER.depth; const t = T(x, y); return t.terrain === 'ocean' ? 1 : t.terrain === 'shallow' ? 0.42 : 0; };
  const bilinear = (f: (x: number, y: number) => number, gx: number, gy: number) => {
    const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    return (f(x0, y0) * (1 - fx) + f(x0 + 1, y0) * fx) * (1 - fy) + (f(x0, y0 + 1) * (1 - fx) + f(x0 + 1, y0 + 1) * fx) * fy;
  };
  const tiles: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (isWater(T(x, y).terrain) && explored(x, y)) tiles.push([x, y]);
  if (!tiles.length) return null;
  const n = detail, row = n + 1;
  const pos: number[] = [], data: number[] = [], index: number[] = [], shoal: number[] = [];
  const vert = (gx: number, gy: number, y: number, shore: number, sand: number) => {
    pos.push(gx - off, y, gy - off);
    data.push(bilinear(depth, gx, gy), shore);
    shoal.push(sand);
    return pos.length / 3 - 1;
  };
  for (const [x, y] of tiles) {
    // Landnachbarn fuer den Uferabstand / land neighbours for the shore distance
    // nur erkundetes Land: das Ufer verraet nie, was unter dem Nebel liegt / explored land only: the shore never reveals what lies under the fog
    const land: [number, number, number][] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const lt = s.tiles[ny * size + nx];
      if (!isWater(lt.terrain) && explored(nx, ny)) land.push([nx, ny, sandy?.(lt, s.tiles[y * size + x]) ? 1 : 0]);
    }
    /** Abstand zum Ufer und ob das naechste Land einen Strand hat / distance to the shore and whether the nearest land has a beach */
    const shoreAt = (gx: number, gy: number): [number, number] => {
      let d = 1, sand = 0;
      for (const [lx, ly, beach] of land) {
        const dl = Math.hypot(Math.max(Math.abs(gx - lx) - 0.5, 0), Math.max(Math.abs(gy - ly) - 0.5, 0));
        if (dl < d - 1e-6 || (dl < d + 1e-6 && beach < sand)) { d = dl; sand = beach; }
      }
      return [d, sand];
    };
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const gx = x - 0.5 + i / n, gy = y - 0.5 + j / n;
      const [d, sand] = shoreAt(gx, gy);
      vert(gx, gy, bilinear(height, gx, gy) - SURFACE_DROP, d, sand);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = base + j * row + i, b = a + 1, c = a + row, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    // Schuerze am Kartenrand / skirt at the map edge
    const edges: [boolean, number[]][] = [
      [y === 0, Array.from({ length: row }, (_, i) => base + i)],
      [y === size - 1, Array.from({ length: row }, (_, i) => base + n * row + (n - i))],
      [x === 0, Array.from({ length: row }, (_, j) => base + (n - j) * row)],
      [x === size - 1, Array.from({ length: row }, (_, j) => base + j * row + n)],
    ];
    for (const [on, ids] of edges) {
      if (!on) continue;
      const bottom = ids.map((id) => {
        const k = pos.length / 3;
        pos.push(pos[id * 3], WATER_BOX_TOP - 0.01, pos[id * 3 + 2]);
        data.push(data[id * 2], 1);
        shoal.push(0);
        return k;
      });
      for (let i = 0; i < n; i++) index.push(ids[i], ids[i + 1], bottom[i], ids[i + 1], bottom[i + 1], bottom[i]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('water', new THREE.Float32BufferAttribute(data, 2));
  g.setAttribute('shoal', new THREE.Float32BufferAttribute(shoal, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, waterMaterial(s.config.theme === 'alien'));
  mesh.raycast = () => {};
  mesh.renderOrder = 1;
  mesh.userData.dispose = true;
  return mesh;
}

/** Bodenhoehe unterhalb der Wasserflaeche (TILE_BOTTOM bleibt) / floor height below the surface */
export const WATER_BOX_HEIGHT = WATER_BOX_TOP - TILE_BOTTOM;
