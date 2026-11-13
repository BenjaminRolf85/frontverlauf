/**
 * Atmosphaere fuer die statische Landschaft: gemeinsame Uniforms fuer Zeit, Nacht, Leuchten und Dunst,
 * Leuchtmasken je Geometrie (Lava, Xeno-Glimmen, NEXUS-Cyan, Fenster) und die passenden Materialien.
 * Atmosphere for the static landscape: shared uniforms for time, night, glow and haze,
 * glow masks per geometry (lava, xeno glimmer, NEXUS cyan, windows) and the matching materials.
 *
 * Einheiten bleiben bewusst aussen vor (eigenes Material). / Units are deliberately left out (own material).
 */
import * as THREE from 'three';
import { factionTokens, hex, primitives, semantic } from '../design/tokens';
import { toonMaterial } from './toon';

/** Gemeinsame Uniforms (werden von View/Sky jedes Bild gesetzt) / shared uniforms (set every frame by View/Sky) */
export const ATMO = {
  /** Zeit in Sekunden, steht still ohne Animationen / time in seconds, frozen without animations */
  uTime: { value: 0 },
  /** 0 = Tag, 1 = Nacht / 0 = day, 1 = night */
  uNight: { value: 0 },
  /** Staerke selbstleuchtender Teile (Lava, Xeno, Cyan) / strength of self-lit parts */
  uGlow: { value: 0.25 },
  /** Fensterlicht 0..1 / window light 0..1 */
  uWindow: { value: 0 },
  uWindowColor: { value: new THREE.Color(hex(semantic.cityWindow)) },
  /** Dunst zum Kartenrand / haze toward the map edge */
  uHaze: { value: 0.3 },
  uHazeColor: { value: new THREE.Color(hex(semantic.hazeDay)) },
  /** halbe Kartengroesse in Weltkoordinaten / half map size in world units */
  uHazeHalf: { value: 7 },
  /** Gesamthelligkeit der Szene fuer unbeleuchtete Shader (Wasser) / overall scene light for unlit shaders (water) */
  uLight: { value: new THREE.Color(1, 1, 1) },
};

// ---------- Leuchtmasken / glow masks ----------

/** Art der Leuchtmaske / kind of glow mask */
export type GlowKind = 'none' | 'nature' | 'built' | 'lava' | 'xenoGround';

const keyColor = (h: string) => new THREE.Color(hex(h));
const p = primitives.color;
/** Schluesselfarben: Vertexfarben, die leuchten / key colours: vertex colours that glow */
const KEYS = {
  self: [keyColor(semantic.xenoGlow), keyColor(semantic.xenoAcid), keyColor(factionTokens.nexus.marker)],
  lava: [keyColor(p.orange500), keyColor(p.yellow400), keyColor(p.red500), keyColor(semantic.lava), keyColor(semantic.lavaGlow)],
  window: [keyColor(p.sky800)],
};
const near = (r: number, g: number, b: number, c: THREE.Color) => Math.abs(r - c.r) + Math.abs(g - c.g) + Math.abs(b - c.b) < 0.012;

/**
 * Leuchtattribut 'glow' (vec2) anlegen: x = Eigenleuchten, y = Fensterlicht (Wert = Anteil beleuchteter Fenster).
 * Wird einmal je Geometrie berechnet (die Geometrien sind gecacht).
 * Create the 'glow' attribute (vec2): x = self glow, y = window light (value = share of lit windows).
 * Computed once per geometry (geometries are cached).
 */
export function withGlow(g: THREE.BufferGeometry, kind: GlowKind = 'nature', windows = 0.55): THREE.BufferGeometry {
  const tag = `${kind}-${windows}`;
  if (g.userData.glowTag === tag && g.getAttribute('glow')) return g;
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');
  const nor = g.getAttribute('normal');
  const arr = new Float32Array(pos.count * 2);
  if (kind !== 'none') {
    for (let i = 0; i < pos.count; i++) {
      if (kind === 'xenoGround') {
        // nur die Oberseite der Xeno-Kachel glimmt / only the top of the xeno tile glimmers
        if (nor && nor.getY(i) > 0.5) arr[i * 2] = 0.35;
        continue;
      }
      if (!col) break;
      const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
      if (KEYS.self.some((c) => near(r, gg, b, c))) arr[i * 2] = 1;
      else if (kind === 'lava' && KEYS.lava.some((c) => near(r, gg, b, c))) arr[i * 2] = 1;
      else if (kind === 'built' && KEYS.window.some((c) => near(r, gg, b, c))) arr[i * 2 + 1] = windows;
    }
  }
  g.setAttribute('glow', new THREE.BufferAttribute(arr, 2));
  g.userData.glowTag = tag;
  return g;
}

// ---------- Shader-Bausteine / shader chunks ----------

const VERT_HEAD = /* glsl */ `
attribute vec2 glow;
varying vec2 vGlow;
varying vec3 vAtmoWorld;
`;
const VERT_BODY = /* glsl */ `
  vGlow = glow;
  vec4 atmoW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    atmoW = instanceMatrix * atmoW;
  #endif
  vAtmoWorld = (modelMatrix * atmoW).xyz;
`;
export const HAZE_GLSL = /* glsl */ `
uniform float uHaze;
uniform vec3 uHazeColor;
uniform float uHazeHalf;
float atmoHaze(vec3 w) {
  float e = max(abs(w.x), abs(w.z));
  return smoothstep(uHazeHalf - 3.2, uHazeHalf + 0.6, e) * uHaze;
}
`;
const FRAG_HEAD = /* glsl */ `
uniform float uGlow;
uniform float uWindow;
uniform vec3 uWindowColor;
varying vec2 vGlow;
varying vec3 vAtmoWorld;
${HAZE_GLSL}
float atmoHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
`;
const FRAG_GLOW = /* glsl */ `
  #ifdef USE_COLOR
    vec3 atmoC = vColor.rgb;
  #else
    vec3 atmoC = diffuse;
  #endif
  // Eigenleuchten in der eigenen Farbe, auf Helligkeit normiert / self glow in its own colour, normalised to brightness
  float atmoL = max(dot(atmoC, vec3(0.2126, 0.7152, 0.0722)), 0.08);
  totalEmissiveRadiance += atmoC / atmoL * vGlow.x * uGlow * 0.32;
  // Fenster: nur ein Teil leuchtet, je Zelle zufaellig / windows: only some are lit, random per cell
  if (vGlow.y > 0.0 && uWindow > 0.0) {
    float atmoLit = step(atmoHash(floor(vAtmoWorld * 26.0)), vGlow.y);
    totalEmissiveRadiance += uWindowColor * atmoLit * uWindow * 1.25;
  }
`;
/**
 * Schatten auch im Umgebungslicht, sonst sind sie neben dem starken Himmelslicht kaum zu sehen.
 * Shadows also in the ambient light, otherwise they barely show next to the strong sky light.
 */
const FRAG_SHADOW = /* glsl */ `
  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if (receiveShadow) {
      DirectionalLightShadow atmoSh = directionalLightShadows[ 0 ];
      float atmoS = getShadow( directionalShadowMap[ 0 ], atmoSh.shadowMapSize, atmoSh.shadowIntensity, atmoSh.shadowBias, atmoSh.shadowRadius, vDirectionalShadowCoord[ 0 ] );
      reflectedLight.indirectDiffuse *= mix( 1.0, atmoS, 0.5 );
    }
  #endif
`;
const FRAG_HAZE = /* glsl */ `
  outgoingLight = mix(outgoingLight, uHazeColor, atmoHaze(vAtmoWorld));
`;

function hookUniforms(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uGlow = ATMO.uGlow;
  shader.uniforms.uWindow = ATMO.uWindow;
  shader.uniforms.uWindowColor = ATMO.uWindowColor;
  shader.uniforms.uHaze = ATMO.uHaze;
  shader.uniforms.uHazeColor = ATMO.uHazeColor;
  shader.uniforms.uHazeHalf = ATMO.uHazeHalf;
}

/**
 * Toon-Shader um Leuchten und Dunst erweitern. extraVertex wird nach begin_vertex eingefuegt (z. B. Wiegen).
 * Extend the toon shader with glow and haze. extraVertex is inserted after begin_vertex (e.g. sway).
 */
export function patchAtmosphere(shader: THREE.WebGLProgramParametersWithUniforms, extraVertex = '', extraHead = '') {
  hookUniforms(shader);
  shader.vertexShader = VERT_HEAD + extraHead + shader.vertexShader
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${extraVertex}\n${VERT_BODY}`);
  shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_GLOW}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_SHADOW}`)
    .replace('#include <opaque_fragment>', `${FRAG_HAZE}\n#include <opaque_fragment>`);
}

let land: THREE.MeshToonMaterial | null = null;
/**
 * Material fuer Felder, Deko, Staedte und Gebaeude (Geometrie braucht das Attribut 'glow', siehe withGlow).
 * Material for tiles, decoration, cities and buildings (geometry needs the 'glow' attribute, see withGlow).
 */
export function landMaterial(): THREE.MeshToonMaterial {
  if (land) return land;
  const m = toonMaterial().clone();
  m.onBeforeCompile = (shader) => patchAtmosphere(shader);
  m.customProgramCacheKey = () => 'atmo-land';
  land = m;
  return m;
}

let decal: THREE.MeshToonMaterial | null = null;
/** Flache Bodenmarken (Krater, Spuren, Flecken), beleuchtet wie der Boden / flat ground marks, lit like the ground */
export function decalMaterial(): THREE.MeshToonMaterial {
  if (decal) return decal;
  const m = landMaterial().clone();
  m.onBeforeCompile = (shader) => patchAtmosphere(shader);
  m.customProgramCacheKey = () => 'atmo-land';
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  decal = m;
  return m;
}

// ---------- Wolken des Kriegsnebels / fog of war clouds ----------

/** Langsames Treiben der Wolken je Instanz / slow drift of clouds per instance */
const DRIFT_GLSL = /* glsl */ `
  #ifdef USE_INSTANCING
    vec3 driftBase = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #else
    vec3 driftBase = vec3(0.0);
  #endif
  float driftPh = driftBase.x * 1.3 + driftBase.z * 0.7;
  transformed.x += sin(uTime * 0.23 + driftPh) * 0.05;
  transformed.z += cos(uTime * 0.19 + driftPh * 1.4) * 0.04;
  transformed.y += sin(uTime * 0.5 + driftPh * 2.1) * 0.012;
`;

let cloudMat: THREE.MeshToonMaterial | null = null;
/** Wolkenmaterial mit Treiben und Dunst / cloud material with drift and haze */
export function cloudMaterial(): THREE.MeshToonMaterial {
  if (cloudMat) return cloudMat;
  const m = toonMaterial().clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = ATMO.uTime;
    patchAtmosphere(shader, DRIFT_GLSL, 'uniform float uTime;\n');
  };
  m.customProgramCacheKey = () => 'atmo-cloud';
  cloudMat = m;
  return m;
}

const cloudLines = new Map<number, THREE.ShaderMaterial>();
/** Kontur mit demselben Treiben / outline with the same drift */
export function cloudOutline(width: number): THREE.ShaderMaterial {
  let m = cloudLines.get(width);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: { uWidth: { value: width }, uColor: { value: new THREE.Color(hex(semantic.ink)) }, uTime: ATMO.uTime },
    vertexShader: /* glsl */ `
      uniform float uWidth; uniform float uTime;
      void main() {
        vec3 transformed = position;
        ${DRIFT_GLSL}
        vec4 p = vec4(transformed + normal * uWidth, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: 'uniform vec3 uColor; void main() { gl_FragColor = vec4(uColor, 1.0); }',
    side: THREE.BackSide,
  });
  cloudLines.set(width, m);
  return m;
}
