/**
 * Gezeichnete Einheiten: erweiterter Toon-Shader / inked units: extended toon shader.
 *
 * Grundlage bleibt MeshToonMaterial mit Vertexfarben und den Lichtern der Szene (wie unitMaterial in toon.ts), per
 * onBeforeCompile erweitert, so wie atmosphere.ts es fuer Dunst und Leuchten tut:
 * - Zeichnung: RGBA-Textur (mul / abs, siehe atlas.ts) auf die Vertexfarbe.
 * - Tusche: Abstandsfeld-Textur, scharfe Linie in jeder Vergroesserung, Strichstaerke schwankt leicht.
 * - Schatten: drei flache Toene (Licht, Mittelton, Schatten) wie die Stufentextur, dazu die Verdeckung aus den
 *   Vertexfarben. KEINE Schraffur, keine Strich- oder Punktmuster.
 * - Kantenlicht und harter Glanzfleck auf Metall und Glas (nur hohe Qualitaet).
 * Varianten wie bei unitMaterial: abgedunkelt (gezogen), durchsichtig (getarnt, Radarkontakt), leuchtend (Velkar, Alvenia).
 * The base stays MeshToonMaterial with vertex colours and the scene lights (like unitMaterial in toon.ts), extended via
 * onBeforeCompile the way atmosphere.ts does for haze and glow:
 * - drawing: RGBA texture (mul / abs, see atlas.ts) on the vertex colour.
 * - ink: distance field texture, a sharp line at any magnification, the line weight wavers slightly.
 * - shadow: three flat tones (light, mid tone, shadow) like the gradient map, plus the occlusion from the vertex
 *   colours. NO hatching, no stroke or dot patterns.
 * - rim light and a hard glint on metal and glass (high quality only).
 * Variants as for unitMaterial: dimmed (has moved), transparent (camouflaged, radar contact), glowing (Velkar, Alvenia).
 */
import * as THREE from 'three';
import { hex, semantic } from '../../../design/tokens';
import { gradientMap, TOON_RAMP, UNIT_BRIGHTNESS, UNIT_DIM } from '../../toon';
import { ATLAS_SIZE, atlasTextures } from './atlas';

export type InkedQuality = keyof typeof ATLAS_SIZE;
export interface InkedMatOpts { transparent?: boolean; opacity?: number; dim?: boolean; glow?: boolean }

/** Schalter der Ebenen (1 = an) fuer die Vorschau / layer switches (1 = on) for the preview */
export const LAYERS = {
  /** x Zeichnung, y Tusche, z Verdeckung / x drawing, y ink, z occlusion */
  uLayers: { value: new THREE.Vector3(1, 1, 1) },
  /** x Glanz, y Kantenlicht / x glint, y rim light */
  uLayers2: { value: new THREE.Vector2(1, 1) },
};
/** Leuchten: Grundwert bei Tag, Zuschlag bei Nacht (wie UNIT_GLOW in atmosphere.ts) / glow: base by day, extra at night (as UNIT_GLOW in atmosphere.ts) */
const GLOW = { base: 0.55, night: 0.6 };
/** Niedrige Qualitaet: Verschiebung der Tuscheschwelle im Abstandsfeld (0..1 = 2 x SDF_RANGE Texel) / low quality: shift of the ink threshold in the distance field (0..1 = 2 x SDF_RANGE texels) */
export const LOW_INK_BIAS = 0.06;

const VERT_HEAD = /* glsl */ `
  attribute vec2 fx;
  varying vec2 vBUv;
  varying vec2 vBFx;
  #ifdef INKED_GLOW
    attribute vec2 glow;
    varying float vUnitGlow;
  #endif
`;
const VERT_BODY = /* glsl */ `
  vBUv = uv;
  vBFx = fx;
  #ifdef INKED_GLOW
    vUnitGlow = glow.x;
  #endif
`;
const FRAG_HEAD = /* glsl */ `
  uniform sampler2D uPaint;
  uniform sampler2D uInkMap;
  uniform vec3 uInkColor;
  uniform vec3 uAbsTint;
  uniform vec3 uLayers;
  uniform vec2 uLayers2;
  uniform float uShadowTone;
  varying vec2 vBUv;
  varying vec2 vBFx;
  #ifdef INKED_HIGH
    // Rauschen fuer die schwankende Strichstaerke der Tusche / noise for the wavering weight of the ink line
    float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float bNoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
  #endif
  #ifdef INKED_GLOW
    uniform float uGlow;
    varying float vUnitGlow;
  #endif
`;
/** Zeichnung auf die Vertexfarbe / drawing onto the vertex colour */
const FRAG_PAINT = /* glsl */ `
  {
    vec4 bT = texture2D(uPaint, vBUv);
    vec3 bMul = pow(2.0 * bT.rgb, vec3(2.2));
    vec3 bAbs = pow(bT.rgb, vec3(2.2)) * uAbsTint;
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * bMul, bAbs, bT.a), uLayers.x);
  }
`;
const FRAG_GLOW = /* glsl */ `
  #ifdef INKED_GLOW
  {
    float bGl = max(dot(vColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.08);
    totalEmissiveRadiance += vColor.rgb / bGl * vUnitGlow * (${GLOW.base.toFixed(2)} + uGlow * ${GLOW.night.toFixed(2)}) * uAbsTint.r;
  }
  #endif
`;
/** Sonnenlicht neu: drei flache Toene, die Verdeckung schiebt die Stufen / sun light redone: three flat tones, the occlusion shifts the steps */
const FRAG_LIGHT = /* glsl */ `
  #if NUM_DIR_LIGHTS > 0
  {
    float bAo = mix(1.0, vBFx.y, uLayers.z);
    float bNdl = dot(normal, directionalLights[0].direction) - (1.0 - bAo) * 0.85;
    // Stufen wie die Stufentextur / steps like the gradient map
    float bK = bNdl > 0.3333 ? 1.0 : bNdl > -0.3333 ? ${(TOON_RAMP.hard[1] / 255).toFixed(4)} : uShadowTone;
    reflectedLight.directDiffuse = bK * directionalLights[0].color * BRDF_Lambert(material.diffuseColor);
    reflectedLight.indirectDiffuse *= mix(1.0, bAo, 0.5);
  }
  #endif
`;
/** Kantenlicht, Glanz, Tusche / rim light, glint, ink */
const FRAG_INK = /* glsl */ `
  #if defined( INKED_HIGH ) && NUM_DIR_LIGHTS > 0
  {
    vec3 bL = directionalLights[0].direction;
    float bRimF = 1.0 - max(dot(normal, geometryViewDir), 0.0);
    vec3 bRimDir = normalize(vec3(-bL.x, 0.3, -0.35));
    float bRim = smoothstep(0.66, 0.7, bRimF) * smoothstep(0.05, 0.3, dot(normal, bRimDir)) * uLayers2.y;
    outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.5 + 0.12, bRim * 0.6);
    // Glanzfleck mit harter Kante, auf blankem Metall ein kleiner zweiter / hard-edged glint, a small second one on bright metal
    vec3 bH = normalize(bL + geometryViewDir);
    float bSpec = pow(max(dot(normal, bH), 0.0), mix(60.0, 260.0, 1.0 - vBFx.x));
    vec3 bH2 = normalize(bL + geometryViewDir + vec3(0.2, -0.26, 0.0));
    float bSpec2 = pow(max(dot(normal, bH2), 0.0), 900.0);
    float bGlint = max(smoothstep(0.46, 0.54, bSpec), smoothstep(0.46, 0.54, bSpec2) * step(0.7, vBFx.x)) * step(0.01, vBFx.x) * uLayers2.x;
    outgoingLight = mix(outgoingLight, vec3(1.0), bGlint * 0.88);
  }
  #endif
  {
    float bD = texture2D(uInkMap, vBUv).r;
    float bW = clamp(fwidth(bD), 0.002, 0.5);
    #ifdef INKED_HIGH
      bD += (bNoise(vBUv * 150.0) - 0.5) * 0.085 + (bNoise(vBUv * 37.0) - 0.5) * 0.06;
    #else
      // niedrig: halbe Textur und halbe Bildaufloesung, die Striche etwas kraeftiger, damit sie nicht wegbrechen
      // low: half the texture and half the screen resolution, strokes a little heavier so they do not break away
      bD += ${LOW_INK_BIAS.toFixed(3)};
    #endif
    float bInk = smoothstep(0.5 - bW, 0.5 + bW, bD) * uLayers.y;
    outgoingLight = mix(outgoingLight, uInkColor, bInk);
  }
`;

const mats = new Map<string, THREE.MeshToonMaterial>();
/** Aufrufe uGlow des Brettes (atmosphere.ts ATMO.uGlow); gesetzt von unitDraw.ts / the board's uGlow (atmosphere.ts ATMO.uGlow); set by unitDraw.ts */
export const GLOW_UNIFORM: { ref: { value: number } } = { ref: { value: 0 } };

/**
 * Material fuer gezeichnete Einheiten eines Atlas, je Qualitaet und Variante zwischengespeichert.
 * Material for inked units of one atlas, cached per quality and variant.
 */
export function comicMaterial(atlas: string, quality: InkedQuality, o: InkedMatOpts = {}): THREE.MeshToonMaterial {
  const key = `${atlas}|${quality}|${o.transparent ? 1 : 0}|${o.opacity ?? 1}|${o.dim ? 1 : 0}|${o.glow ? 1 : 0}`;
  let m = mats.get(key);
  if (m) return m;
  const tex = atlasTextures(atlas, ATLAS_SIZE[quality]);
  m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap(), transparent: !!o.transparent, opacity: o.opacity ?? 1 });
  // wie unitMaterial: gezogene Einheiten dunkler und leicht grau / like unitMaterial: units that have moved darker and slightly grey
  const tint = new THREE.Vector3(1, 1, 1);
  if (o.dim) { m.color.setRGB(UNIT_DIM, UNIT_DIM, UNIT_DIM * 1.15); tint.set(UNIT_DIM, UNIT_DIM, UNIT_DIM * 1.15); } else m.color.setScalar(UNIT_BRIGHTNESS);
  const uniforms = {
    uPaint: { value: tex.paint }, uInkMap: { value: tex.ink },
    uInkColor: { value: new THREE.Color(hex(semantic.ink)) },
    uAbsTint: { value: tint },
    uShadowTone: { value: TOON_RAMP.hard[0] / 255 },
  };
  const defines = `${quality === 'high' ? '#define INKED_HIGH\n' : ''}${o.glow ? '#define INKED_GLOW\n' : ''}`;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, LAYERS, { uGlow: GLOW_UNIFORM.ref });
    shader.vertexShader = defines + VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = defines + FRAG_HEAD + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_PAINT}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_GLOW}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_LIGHT}`)
      .replace('#include <opaque_fragment>', `${FRAG_INK}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `inked-${quality}-${o.glow ? 1 : 0}`;
  m.userData.unitMat = true;
  m.userData.unitGlow = !!o.glow;
  m.userData.inked = { atlas, quality, glow: !!o.glow };
  mats.set(key, m);
  return m;
}
