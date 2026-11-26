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
 *
 * Kosten je Bildpunkt (gemessen mit dem Software-Rasterer, dort zaehlt jede Rechnung je Bildpunkt voll):
 * - Flaechen ohne Zeichnung (neutrale Zelle 'blank': ueberbrueckte Teile, kleine Teile) lesen keine der beiden Texturen.
 *   Der Vertex-Shader erkennt die Zelle an den Texturkoordinaten (uBlank) und gibt das je Dreieck gleiche Kennzeichen
 *   vBFx.z weiter; alle Bildpunkte eines Dreiecks nehmen also denselben Zweig.
 * - Die schwankende Strichstaerke der Tusche steckt bei hoher Qualitaet schon im Abstandsfeld (atlas.ts inkWaver),
 *   der Shader rechnet kein Rauschen mehr.
 * - Der Glanzfleck vergleicht den Winkel mit Schwellen, die der Vertex-Shader je Glanzwert ausrechnet (keine Potenz
 *   je Bildpunkt), und entfaellt ganz auf Flaechen ohne Glanz.
 * - Die Zeichnung braucht eine Potenz statt zwei: (2 x)^2.2 = 2^2.2 * x^2.2.
 * Cost per fragment (measured with the software rasteriser, where every per-fragment operation counts in full):
 * - Surfaces without drawing (neutral cell 'blank': bridged parts, small parts) read neither texture. The vertex
 *   shader recognises the cell by its texture coordinates (uBlank) and passes on the flag vBFx.z, which is the same
 *   for a whole triangle; all fragments of a triangle therefore take the same branch.
 * - On high quality the wavering line weight of the ink is already inside the distance field (atlas.ts inkWaver); the
 *   shader computes no noise any more.
 * - The glint compares the angle with thresholds the vertex shader computes per gloss value (no power per fragment)
 *   and is skipped altogether on surfaces without gloss.
 * - The drawing needs one power instead of two: (2 x)^2.2 = 2^2.2 * x^2.2.
 */
import * as THREE from 'three';
import { hex, semantic } from '../../../design/tokens';
import { gradientMap, TOON_RAMP, UNIT_BRIGHTNESS, UNIT_DIM } from '../../toon';
import { ATLAS_SIZE, atlasDef, atlasTextures } from './atlas';
import { REF } from './uvkit';

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

/** mul-Wert der neutralen Zelle: Texel 128 / mul value of the neutral cell: texel 128 */
const NEUTRAL_MUL = Math.pow((2 * 128) / 255, 2.2);
/** Glanzfleck: der Winkelcosinus hoch n wird bei 0.46 .. 0.54 zur harten Kante; dasselbe als Schwellen des Cosinus / glint: the cosine to the power n turns into a hard edge at 0.46 .. 0.54; the same as thresholds of the cosine */
const GLINT = [0.46, 0.54] as const;
/** Exponent des kleinen zweiten Glanzflecks auf blankem Metall / exponent of the small second glint on bright metal */
const GLINT2_POWER = 900;

const VERT_HEAD = /* glsl */ `
  attribute vec2 fx;
  uniform vec4 uBlank;
  varying vec2 vBUv;
  // Glanz, Verdeckung, 1 = Zelle mit Zeichnung (0 = neutrale Zelle) / gloss, occlusion, 1 = cell with drawing (0 = neutral cell)
  varying vec3 vBFx;
  #ifdef INKED_HIGH
    varying vec2 vBGl;
  #endif
  #ifdef INKED_GLOW
    attribute vec2 glow;
    varying float vUnitGlow;
  #endif
`;
const VERT_BODY = /* glsl */ `
  vBUv = uv;
  // uBlank: Mitte und halbe Groesse der neutralen Zelle / centre and half size of the neutral cell
  vBFx = vec3(fx, (abs(uv.x - uBlank.x) > uBlank.z || abs(uv.y - uBlank.y) > uBlank.w) ? 1.0 : 0.0);
  #ifdef INKED_HIGH
    // Schwellen des Glanzflecks fuer den Exponenten dieses Glanzwerts / thresholds of the glint for this gloss value's exponent
    float bPow = 1.0 / mix(60.0, 260.0, 1.0 - fx.x);
    vBGl = vec2(pow(${GLINT[0].toFixed(2)}, bPow), pow(${GLINT[1].toFixed(2)}, bPow));
  #endif
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
  varying vec3 vBFx;
  #ifdef INKED_HIGH
    varying vec2 vBGl;
  #endif
  #ifdef INKED_GLOW
    uniform float uGlow;
    varying float vUnitGlow;
  #endif
`;
/** Zeichnung auf die Vertexfarbe; die neutrale Zelle ohne Texturzugriff / drawing onto the vertex colour; the neutral cell without a texture fetch */
const FRAG_PAINT = /* glsl */ `
  if (vBFx.z > 0.5) {
    vec4 bT = texture2D(uPaint, vBUv);
    // mul = (2 rgb)^2.2 = 2^2.2 * rgb^2.2, abs = rgb^2.2 / mul = (2 rgb)^2.2 = 2^2.2 * rgb^2.2, abs = rgb^2.2
    vec3 bLin = pow(bT.rgb, vec3(2.2));
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb * bLin * ${Math.pow(2, 2.2).toFixed(5)}, bLin * uAbsTint, bT.a), uLayers.x);
  } else {
    diffuseColor.rgb *= mix(1.0, ${NEUTRAL_MUL.toFixed(5)}, uLayers.x);
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
    // Glanzfleck mit harter Kante, auf blankem Metall ein kleiner zweiter; nur auf Flaechen mit Glanz
    // hard-edged glint, a small second one on bright metal; on surfaces with gloss only
    if (vBFx.x >= 0.01) {
      float bGlint = smoothstep(vBGl.x, vBGl.y, dot(normal, normalize(bL + geometryViewDir)));
      if (vBFx.x >= 0.7) bGlint = max(bGlint, smoothstep(${Math.pow(GLINT[0], 1 / GLINT2_POWER).toFixed(7)}, ${Math.pow(GLINT[1], 1 / GLINT2_POWER).toFixed(7)}, dot(normal, normalize(bL + geometryViewDir + vec3(0.2, -0.26, 0.0)))));
      outgoingLight = mix(outgoingLight, vec3(1.0), bGlint * uLayers2.x * 0.88);
    }
  }
  #endif
  if (vBFx.z > 0.5) {
    // hohe Qualitaet: die schwankende Strichstaerke steckt im Abstandsfeld (atlas.ts) / high quality: the wavering line weight is inside the distance field (atlas.ts)
    float bD = texture2D(uInkMap, vBUv).r;
    float bW = clamp(fwidth(bD), 0.002, 0.5);
    #ifndef INKED_HIGH
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
  const blank = atlasDef(atlas).layout.get('blank');
  const uniforms = {
    uPaint: { value: tex.paint }, uInkMap: { value: tex.ink },
    uBlank: { value: new THREE.Vector4((blank.x + blank.w / 2) / REF, (blank.y + blank.h / 2) / REF, blank.w / 2 / REF + 1e-5, blank.h / 2 / REF + 1e-5) },
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
