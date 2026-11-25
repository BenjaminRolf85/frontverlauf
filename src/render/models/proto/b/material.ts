/**
 * Vorschlag B: erweiterter Toon-Shader / proposal B: extended toon shader.
 *
 * Grundlage bleibt MeshToonMaterial mit Vertexfarben und den Lichtern der Szene (wie unitMaterial in toon.ts), per
 * onBeforeCompile erweitert, so wie atmosphere.ts es fuer Dunst und Leuchten tut:
 * - Zeichnung: RGBA-Textur (mul / abs, siehe atlas.ts) auf die Vertexfarbe.
 * - Tusche: Abstandsfeld-Textur, scharfe Linie in jeder Vergroesserung, Strichstaerke schwankt leicht.
 * - Schatten: statt des flachen Mitteltons eine Schraffur im Bildraum, die zum Schatten hin dichter wird; tiefe Fugen
 *   (Umgebungsverdeckung je Ecke) ziehen die Schraffur auch ins Licht.
 * - Kantenlicht auf der Schattenseite und ein harter Glanzfleck auf Metall und Glas (fx.x).
 * The base stays MeshToonMaterial with vertex colours and the scene lights (like unitMaterial in toon.ts), extended via
 * onBeforeCompile the way atmosphere.ts does for haze and glow:
 * - drawing: RGBA texture (mul / abs, see atlas.ts) on the vertex colour.
 * - ink: distance field texture, a sharp line at any magnification, the line weight wavers slightly.
 * - shadow: instead of the flat mid tone a screen space hatching that gets denser towards the shadow; deep joints
 *   (ambient occlusion per vertex) pull the hatching into the light as well.
 * - rim light on the shadow side and a hard glint on metal and glass (fx.x).
 */
import * as THREE from 'three';
import { hex, semantic } from '../../../../design/tokens';
import { gradientMap, TOON_RAMP, UNIT_BRIGHTNESS } from '../../../toon';
import type { AtlasTextures } from './atlas';
import { INK } from './ink';

/** Schalter der Ebenen (1 = an) fuer die Vorschauseite / layer switches (1 = on) for the preview page */
export const LAYERS = {
  /** x Zeichnung, y Tusche, z Schraffur, w Verdeckung / x drawing, y ink, z hatching, w occlusion */
  uLayers: { value: new THREE.Vector4(1, 1, 1, 1) },
  /** x Glanz, y Kantenlicht / x glint, y rim light */
  uLayers2: { value: new THREE.Vector2(1, 1) },
};

const VERT_HEAD = /* glsl */ `
  attribute vec3 fx;
  attribute float ao;
  varying vec2 vBUv;
  varying vec3 vBFx;
`;
const VERT_BODY = /* glsl */ `
  vBUv = uv;
  vBFx = vec3(fx.x, ao, fx.z);
`;
const FRAG_HEAD = /* glsl */ `
  uniform sampler2D uPaint;
  uniform sampler2D uInkMap;
  uniform vec3 uInkColor;
  uniform vec4 uLayers;
  uniform vec2 uLayers2;
  uniform float uDpr;
  uniform float uShadowTone;
  varying vec2 vBUv;
  varying vec3 vBFx;
  float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float bNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bHash(i), bHash(i + vec2(1.0, 0.0)), f.x), mix(bHash(i + vec2(0.0, 1.0)), bHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
`;
/** Zeichnung auf die Vertexfarbe / drawing onto the vertex colour */
const FRAG_PAINT = /* glsl */ `
  {
    vec4 bT = texture2D(uPaint, vBUv);
    vec3 bMul = pow(2.0 * bT.rgb, vec3(2.2));
    vec3 bAbs = pow(bT.rgb, vec3(2.2));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * bMul, bAbs, bT.a), uLayers.x);
  }
`;
/** Sonnenlicht neu: Schraffur statt Mittelton, Verdeckung / sun light redone: hatching instead of the mid tone, occlusion */
const FRAG_LIGHT = /* glsl */ `
  #if NUM_DIR_LIGHTS > 0
  {
    float bAo = mix(1.0, vBFx.y, uLayers.w);
    float bNdl = dot(normal, directionalLights[0].direction) - (1.0 - bAo) * 0.85;
    // Stufen wie die Stufentextur / steps like the gradient map
    float bRamp = bNdl > 0.3333 ? 1.0 : bNdl > -0.3333 ? ${(TOON_RAMP.hard[1] / 255).toFixed(4)} : uShadowTone;
    // Schraffur: Anteil Schatten waechst vom Licht zum Schatten / hatching: the share of shadow grows from light to shadow
    float bDark = clamp((0.3 - bNdl) / 0.68, 0.0, 1.0);
    vec2 bFc = gl_FragCoord.xy / uDpr;
    float bAlong = bFc.x - bFc.y, bAcross = (bFc.x + bFc.y) / 6.2 + 0.35 * sin(bAlong * 0.031);
    float bLine = floor(bAcross);
    // jeder Strich hat eine eigene, schwankende Staerke / every stroke has its own wavering weight
    float bWeight = 0.72 + 0.56 * bNoise(vec2(bAlong * 0.045, bLine * 7.3));
    float bTri = abs(fract(bAcross) - 0.5) * 2.0;
    float bCut = pow(bDark, 1.1) * bWeight * 1.1;
    float bLit = smoothstep(bCut - 0.12, bCut + 0.12, bTri);
    if (bDark <= 0.0) bLit = 1.0;
    float bTone = mix(uShadowTone, 1.0, bLit);
    float bK = mix(bRamp, bTone, uLayers.z * vBFx.z);
    reflectedLight.directDiffuse = bK * directionalLights[0].color * BRDF_Lambert(material.diffuseColor);
    reflectedLight.indirectDiffuse *= mix(1.0, bAo, 0.5);
  }
  #endif
`;
/** Kantenlicht, Glanz, Tusche / rim light, glint, ink */
const FRAG_INK = /* glsl */ `
  #if NUM_DIR_LIGHTS > 0
  {
    vec3 bL = directionalLights[0].direction;
    float bRimF = 1.0 - max(dot(normal, geometryViewDir), 0.0);
    vec3 bRimDir = normalize(vec3(-bL.x, 0.3, -0.35));
    float bRim = smoothstep(0.66, 0.7, bRimF) * smoothstep(0.05, 0.3, dot(normal, bRimDir)) * uLayers2.y;
    outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.5 + 0.12, bRim * 0.6);
    vec3 bH = normalize(bL + geometryViewDir);
    // Glanzfleck mit harter Kante, dazu ein kleiner zweiter wie im Comic / hard-edged glint plus a small second one as in comics
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
    float bBias = (bNoise(vBUv * 150.0) - 0.5) * 0.085 + (bNoise(vBUv * 37.0) - 0.5) * 0.06;
    float bInk = smoothstep(0.5 - bW, 0.5 + bW, bD + bBias) * uLayers.y;
    outgoingLight = mix(outgoingLight, uInkColor, bInk);
  }
`;

/** Comic-Material fuer eine Einheit mit ihren beiden Texturen / comic material for one unit with its two textures */
export function comicMaterial(tex: AtlasTextures): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap() });
  m.color.setScalar(UNIT_BRIGHTNESS);
  const uniforms = {
    uPaint: { value: tex.paint }, uInkMap: { value: tex.ink },
    uInkColor: { value: new THREE.Color(hex(semantic.ink)) },
    uShadowTone: { value: TOON_RAMP.hard[0] / 255 },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, LAYERS, { uDpr: INK.uDpr });
    shader.vertexShader = VERT_HEAD + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = FRAG_HEAD + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAG_PAINT}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_LIGHT}`)
      .replace('#include <opaque_fragment>', `${FRAG_INK}\n#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'proto-b-comic';
  return m;
}
