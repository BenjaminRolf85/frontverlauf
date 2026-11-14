/**
 * MOCKUP (nicht im Spiel): Anfuehrer-Portraets in drei Detailstufen / leader portraits at three detail levels.
 * Stufe 0 = heutiges Spiel-Rendering (Vergleich), 1 = besseres Rendering derselben Geometrie,
 * 2 = zusaetzlich mehr Modellierung, 3 = zusaetzlich im Code gemalte Texturen.
 * Level 0 = today's in-game render (reference), 1 = better render of the same geometry,
 * 2 = plus more modelling, 3 = plus textures painted in code.
 * Wird nur von preview/leadersHD.html benutzt; leaderGeometry() im Spiel bleibt unveraendert.
 * Only used by preview/leadersHD.html; the game's leaderGeometry() is unchanged.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FactionId } from '../../data/balance';
import { factionTokens, hex, semantic } from '../../design/tokens';
import { outlined, unitMaterial } from '../toon';
import { leaderGeometry } from './index';
import { Builder, col, mix, shade, withDetail, type ColorLike, type V3 } from './kit';
import { leader, skinOf } from './leaders';
import { look, mat } from './look';
import { blob, strand, withHD } from './sculpt';

export type HDLevel = 0 | 1 | 2 | 3;
const HALF_PI = Math.PI / 2;

// ---------- Zusatzmodellierung Kleidung (Stufe 2+) / extra clothing modelling (level 2+) ----------

/** Falten kommen in einen eigenen Builder ohne Kontur / folds go into their own builder without outline */
let foldB: Builder | null = null;
/** Stoff-Falte als flacher, leicht dunklerer Wulst / fabric fold as a flat, slightly darker ridge */
function crease(_b: Builder, pts: V3[], r: number, c: ColorLike) {
  strand(foldB ?? _b, pts, r, r * 0.25, shade(c, 0.86), shade(c, 0.94), { seg: 6, flat: 0.4, samples: 18 });
}
/** Stickerei-Ranke aus kleinen Bogen / embroidered vine of small arcs */
function vine(b: Builder, x0: number, x1: number, y: number, z: number, c: ColorLike, n = 5) {
  for (let i = 0; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, dx = (x1 - x0) / n, up = i % 2 ? 1 : -1;
    strand(b, [[x, y, z], [x + dx * 0.5, y + up * 0.012, z], [x + dx, y, z]], 0.0028, 0.0028, c, c, { seg: 5, samples: 8 });
    strand(b, [[x + dx * 0.5, y + up * 0.008, z], [x + dx * 0.35, y + up * 0.022, z], [x + dx * 0.15, y + up * 0.02, z]], 0.0026, 0.001, c, c, { seg: 4, samples: 6 });
  }
}
function epauletteEmbroidery(b: Builder, s: number, y: number, x: number, c: ColorLike) {
  b.group({ p: [s * x, y, -0.005], r: [0, 0, s * -0.24] }, () => {
    b.group({ p: [0, 0.0165, 0], r: [-HALF_PI, 0, 0] }, () => {
      vine(b, -0.07, 0.03, 0.03, 0, c, 4);
      vine(b, -0.07, 0.03, -0.03, 0, c, 4);
      b.add(new THREE.TorusGeometry(0.018, 0.003, 6, 24), c, { p: [s * 0.04, 0, 0] });
    });
  });
}

function clothes(b: Builder, f: FactionId) {
  const L = look(f), gold = mat.gold;
  switch (f) {
    case 'alvenia': {
      const blue = L.primary, white = L.secondary;
      for (const s of [-1, 1]) {
        epauletteEmbroidery(b, s, 0.36, 0.29, gold);
        crease(b, [[s * 0.36, 0.06, 0.15], [s * 0.33, 0.16, 0.18], [s * 0.3, 0.24, 0.18]], 0.012, blue);
        crease(b, [[s * 0.4, 0.22, 0.08], [s * 0.36, 0.3, 0.12], [s * 0.3, 0.34, 0.14]], 0.011, blue);
      }
      // Kragen mit Dicke / collar with thickness
      b.add(new THREE.TorusGeometry(0.1, 0.009, 8, 48), shade(white, 0.92), { p: [0, 0.455, 0], r: [HALF_PI, 0, 0] });
      // Schaerpe mit Fransen unter der Rosette / sash with fringe below the rosette
      for (let i = 0; i < 11; i++) {
        const x = 0.165 + i * 0.007;
        strand(b, [[x, 0.03, 0.222], [x + 0.003, 0.012, 0.224], [x + 0.005, -0.004, 0.222]], 0.0035, 0.002, gold, shade(gold, 0.8), { seg: 4, samples: 6 });
      }
      // Rosette mit Falten / rosette with pleats
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        blob(b, i % 2 ? white : blue, { p: [0.2 + Math.cos(a) * 0.048, 0.06 + Math.sin(a) * 0.048, 0.208], s: [0.016, 0.009, 0.006], r: [0, 0, a] }, 10, 6);
      }
      break;
    }
    case 'korvat': {
      const coat = L.primary;
      for (const s of [-1, 1]) {
        epauletteEmbroidery(b, s, 0.375, 0.31, L.primaryDark);
        crease(b, [[s * 0.4, 0.04, 0.14], [s * 0.37, 0.14, 0.18], [s * 0.33, 0.22, 0.19]], 0.013, coat);
        crease(b, [[s * 0.17, 0.0, 0.2], [s * 0.15, 0.08, 0.215], [s * 0.15, 0.15, 0.215]], 0.01, coat);
        // goldgestickte Eichenranke auf den Kragenspiegeln / gold oak vine on the collar patches
        b.group({ p: [s * 0.1, 0.45, 0.142], r: [0, s * -0.5, 0] }, () => vine(b, -0.024, 0.024, 0, 0.004, shade(gold, 0.8), 3));
      }
      break;
    }
    case 'velkar': {
      const coat = mix(mat.paper, L.primary, 0.35);
      for (const s of [-1, 1]) {
        crease(b, [[s * 0.36, 0.03, 0.14], [s * 0.34, 0.12, 0.17], [s * 0.35, 0.2, 0.16]], 0.012, coat);
        crease(b, [[s * 0.3, 0.3, 0.13], [s * 0.26, 0.34, 0.16], [s * 0.21, 0.36, 0.16]], 0.01, coat);
        // Steppnaht am Kragen / stitched seam on the collar
        for (let i = 0; i < 10; i++) {
          const t = (i + 0.5) / 10;
          b.box(0.009, 0.0025, 0.003, shade(coat, 0.6), [s * (0.11 + t * 0.1), 0.42 - t * 0.21, 0.214], [0, 0, s * -1.1]);
        }
      }
      // Kittelkragen mit Dicke / lab coat collar with thickness
      b.add(new THREE.TorusGeometry(0.085, 0.01, 8, 48), shade(coat, 0.95), { p: [0, 0.44, -0.01], r: [HALF_PI, 0, 0] });
      break;
    }
    default: break;
  }
}

// ---------- Geometrie je Stufe / geometry per level ----------

/** Materialklasse je Vertex: 0 Stoff, 1 Haut, 2 Gold, 3 Haar, 4 schlicht / material class per vertex */
const MTL = { fabric: 0, skin: 1, gold: 2, hair: 3, plain: 4 };

const SKIN: Partial<Record<FactionId, THREE.Color>> = {
  korvat: skinOf(0.97, 0.08), alvenia: skinOf(1.0, 0.05), velkar: skinOf(0.98, 0.04), meridon: skinOf(0.95, 0.12), dravon: skinOf(0.9, 0.02),
};
const HAIR: Partial<Record<FactionId, THREE.Color[]>> = {
  korvat: [col(mat.concrete), col(mat.concreteLight)], alvenia: [col(mat.dark), col(mat.darkMid)], velkar: [col(mat.paper), shade(mat.paper, 0.82), col(mat.concreteLight)],
  meridon: [shade(mat.wood, 0.7), shade(mat.wood, 0.95)],
};

function classify(f: FactionId, g: THREE.BufferGeometry) {
  const c = g.getAttribute('color'), p = g.getAttribute('position');
  const out = new Float32Array(c.count);
  const skin = SKIN[f], hair = HAIR[f] ?? [];
  const v = new THREE.Color();
  const near = (a: THREE.Color, b: THREE.Color, e: number) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < e;
  for (let i = 0; i < c.count; i++) {
    v.setRGB(c.getX(i), c.getY(i), c.getZ(i));
    const lum = 0.3 * v.r + 0.59 * v.g + 0.11 * v.b;
    let m = MTL.plain;
    if (skin && near(v, skin, 0.03)) m = MTL.skin;
    else if (v.r > 0.6 && v.g > 0.4 && v.b < 0.3 && v.r - v.b > 0.45) m = MTL.gold;
    else if (hair.some((h) => near(v, h, 0.06)) && p.getY(i) > 0.45) m = MTL.hair;
    else if (lum > 0.12 && Math.min(v.r, v.g, v.b) < 0.9 && p.getY(i) < 0.52) m = MTL.fabric;
    out[i] = m;
  }
  g.setAttribute('mtl', new THREE.BufferAttribute(out, 1));
}

const geoCache = new Map<string, THREE.BufferGeometry>();
export function hdGeometry(f: FactionId, level: HDLevel): THREE.BufferGeometry {
  const key = `${f}|${level >= 2 ? (level >= 3 ? 3 : 2) : 1}`;
  let g = geoCache.get(key);
  if (g) return g;
  if (level < 2) g = leaderGeometry(f).clone();
  else {
    g = withDetail(1, true, () => withHD(level, () => {
      const b = leader(f, 'neutral');
      foldB = new Builder();
      clothes(b, f);
      const main = b.build(), folds = foldB.build();
      foldB = null;
      const merged = mergeGeometries([main, ...(folds.getAttribute('position') ? [folds] : [])])!;
      merged.userData.noHullFrom = main.getAttribute('position').count / 3;
      return merged;
    }));
  }
  classify(f, g);
  geoCache.set(key, g);
  return g;
}

// ---------- Gemalte Texturen (Stufe 3) / painted textures (level 3) ----------

/** Kopfdaten fuer die Gesichtsbemalung (aus leaders.ts) / head data for the face paint (from leaders.ts) */
const HEAD: Partial<Record<FactionId, { c: V3; r: V3; eyeY: number; noseY: number; mouthY: number }>> = {
  korvat: { c: [0, 0.665, 0.03], r: [0.175, 0.19, 0.172], eyeY: 0.12, noseY: -0.22, mouthY: -0.6 },
  alvenia: { c: [0, 0.665, 0.03], r: [0.152, 0.178, 0.158], eyeY: 0.1, noseY: -0.19, mouthY: -0.44 },
  velkar: { c: [0, 0.665, 0.03], r: [0.128, 0.2, 0.15], eyeY: 0.1, noseY: -0.27, mouthY: -0.66 },
};
const FACE_SPAN = 0.5;

function faceTexture(f: FactionId): THREE.CanvasTexture {
  const N = 512, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d')!;
  const H = HEAD[f], skin = SKIN[f] ?? col(mat.skin);
  const css = (c: THREE.Color, a = 1) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
  if (H) {
    // Normkoordinaten des Kopfes -> Pixel / normalised head coordinates -> pixels
    const px = (x: number) => (0.5 + (x * H.r[0]) / FACE_SPAN) * N;
    const py = (y: number) => (0.5 - (y * H.r[1]) / FACE_SPAN) * N;
    const sx = (w: number) => (w * H.r[0] / FACE_SPAN) * N, sy = (h: number) => (h * H.r[1] / FACE_SPAN) * N;
    const ell = (x: number, y: number, w: number, h: number, c: string, rot = 0) => {
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(px(x), py(y), sx(w), sy(h), rot, 0, Math.PI * 2); ctx.fill();
    };
    const warm = mix(skin, mat.red, 0.55);
    const cheekA = f === 'korvat' ? 0.4 : f === 'velkar' ? 0.2 : 0.38;
    for (const s of [-1, 1]) {
      // Wangenroete als klare Form mit hellerem Kern / cheek blush as a clean shape with a lighter core
      ell(s * 0.5, -0.24, 0.17, 0.09, css(warm, cheekA * 0.38), s * 0.15);
      // drei kurze Schraffurstriche auf der Wange / three short hatch strokes on the cheek
      ctx.strokeStyle = css(shade(warm, 0.8), 0.5); ctx.lineWidth = N * 0.006; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.moveTo(px(s * (0.42 + k * 0.06)), py(-0.2)); ctx.lineTo(px(s * (0.4 + k * 0.06)), py(-0.27)); ctx.stroke();
      }
    }
    // Nasenspitze / nose tip
    ell(0, H.noseY - 0.01, 0.1, 0.055, css(warm, f === 'korvat' ? 0.55 : 0.3));
    if (f === 'alvenia') {
      // Sommersprossen ueber Nase und Wangen / freckles across nose and cheeks
      const pts = [[-0.32, -0.12], [-0.26, -0.18], [-0.2, -0.1], [-0.14, -0.15], [-0.36, -0.2], [0.32, -0.12], [0.26, -0.18], [0.2, -0.1], [0.14, -0.15], [0.36, -0.2], [-0.05, -0.06], [0.05, -0.07], [0.0, -0.11]];
      for (const [x, y] of pts) ell(x, y, 0.016, 0.012, css(shade(skin, 0.68), 0.85));
    }
    if (f === 'velkar') {
      // Altersflecken an Schlaefe und Stirn, Schatten unter dem Wangenknochen
      // age spots on temple and forehead, shadow below the cheekbone
      for (const [x, y, w] of [[-0.55, 0.32, 0.05], [-0.42, 0.42, 0.03], [0.5, 0.36, 0.04], [0.2, 0.55, 0.03]]) ell(x, y, w, w * 0.8, css(mix(skin, mat.wood, 0.5), 0.6));
    }
    if (f === 'korvat') {
      // geplatzte Aederchen auf der Nase / broken veins on the nose
      ctx.strokeStyle = css(mix(warm, mat.red, 0.4), 0.6); ctx.lineWidth = N * 0.003;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(px(s * 0.03), py(H.noseY + 0.02)); ctx.lineTo(px(s * 0.08), py(H.noseY - 0.02)); ctx.lineTo(px(s * 0.06), py(H.noseY - 0.05)); ctx.stroke(); }
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let weaveTex: THREE.CanvasTexture | null = null;
function weave(): THREE.CanvasTexture {
  if (weaveTex) return weaveTex;
  const N = 64, cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, N, N);
  // Koeper-Bindung: diagonale Fadenreihen / twill weave: diagonal thread rows
  for (let i = -N; i < N * 2; i += 8) {
    ctx.strokeStyle = '#a8a8a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + N, N); ctx.stroke();
    ctx.strokeStyle = '#5c5c5c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(i + 4, 0); ctx.lineTo(i + 4 + N, N); ctx.stroke();
  }
  weaveTex = new THREE.CanvasTexture(cv);
  weaveTex.wrapS = weaveTex.wrapT = THREE.RepeatWrapping;
  return weaveTex;
}

// ---------- Material / material ----------

function bandMap(): THREE.DataTexture {
  // vier Toenstufen / four tone bands
  const v = [72, 128, 196, 255];
  const d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  const t = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

function hdMaterial(f: FactionId, level: HDLevel): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: bandMap() });
  m.color.setScalar(1.1);
  const H = HEAD[f];
  const uniforms = {
    uRim: { value: new THREE.Color(hex(factionTokens[f].secondary)) },
    uFace: { value: level >= 3 ? faceTexture(f) : null },
    uWeave: { value: level >= 3 ? weave() : null },
    uHead: { value: new THREE.Vector2(H?.c[0] ?? 0, H?.c[1] ?? 0.665) },
    uSpan: { value: FACE_SPAN },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.defines = { ...(sh.defines ?? {}), HD_LEVEL: level };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float mtl;\nvarying float vMtl;\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMtl = mtl; vObjPos = position; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vMtl;
varying vec3 vObjPos;
varying vec3 vObjN;
uniform vec3 uRim;
uniform vec2 uHead;
uniform float uSpan;
#if HD_LEVEL >= 3
uniform sampler2D uFace;
uniform sampler2D uWeave;
#endif`)
      .replace('#include <color_fragment>', `#include <color_fragment>
#if HD_LEVEL >= 3
  if (vMtl > 0.5 && vMtl < 1.5 && vObjN.z > 0.15) {
    vec2 fuv = vec2(0.5 + (vObjPos.x - uHead.x) / uSpan, 0.5 + (vObjPos.y - uHead.y) / uSpan);
    vec4 fp = texture2D(uFace, fuv);
    diffuseColor.rgb = mix(diffuseColor.rgb, fp.rgb, fp.a);
  }
  if (vMtl < 0.5) {
    vec3 an = abs(normalize(vObjN));
    float w = texture2D(uWeave, vObjPos.yz * 28.0).r * an.x + texture2D(uWeave, vObjPos.xz * 28.0).r * an.y + texture2D(uWeave, vObjPos.xy * 28.0).r * an.z;
    w /= (an.x + an.y + an.z);
    diffuseColor.rgb *= 0.9 + 0.2 * w;
  }
#endif`)
      .replace('#include <opaque_fragment>', `
  {
    vec3 V = normalize(vViewPosition);
    float fres = 1.0 - max(dot(normal, V), 0.0);
    // Randlicht in Fraktions-Zweitfarbe, nur auf der dem Hauptlicht abgewandten Seite
    // rim light in faction secondary colour, only on the side away from the key light
    float side = dot(normal, normalize(vec3(-1.0, 0.35, -0.2)));
    float rim = step(0.66, fres) * step(0.2, side);
    outgoingLight = mix(outgoingLight, outgoingLight * 0.6 + uRim * 0.6, rim * 0.55);
#if HD_LEVEL >= 3
    #if NUM_DIR_LIGHTS > 0
    vec3 Ld = directionalLights[0].direction;
    float spec = pow(max(dot(normal, normalize(Ld + V)), 0.0), 48.0);
    if (vMtl > 1.5 && vMtl < 2.5) outgoingLight += vec3(1.0) * step(0.45, spec) * 0.9 + uRim * 0.15 * step(0.15, spec);
    if (vMtl > 2.5 && vMtl < 3.5) outgoingLight += vec3(0.3) * step(0.6, pow(max(dot(normal, normalize(Ld + V)), 0.0), 20.0));
    #endif
    // Rasterpunkte in den Schatten (Druckoptik) / halftone dots in the shadows (print look)
    float base = max(dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)), 0.02);
    float shadeK = dot(outgoingLight, vec3(0.3, 0.59, 0.11)) / base;
    if (shadeK < 0.9 && base > 0.08) {
      vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 7.0;
      float d = length(fract(g) - 0.5);
      float rad = clamp((0.9 - shadeK) * 0.9, 0.0, 0.42);
      outgoingLight *= 1.0 - 0.22 * step(d, rad);
    }
#endif
  }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `hd-${f}-${level}`;
  return m;
}

// ---------- Nachbearbeitung: AO + Innenlinien / post: AO + inner lines ----------

const POST_FRAG = /* glsl */ `
uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tDepth;
uniform vec2 res; uniform float near; uniform float far; uniform float aoRadius; uniform vec3 ink;
varying vec2 vUv;
float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).r; return (near * far) / ((far - near) * d - far); }
void main() {
  vec4 c = texture2D(tColor, vUv);
  if (c.a < 0.01) { gl_FragColor = c; return; }
  float z = viewZ(vUv);
  // Kontaktschatten: Nachbarn deutlich naeher an der Kamera verdecken / contact shadow: neighbours much closer to the camera occlude
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    float a = float(i) * 2.39996;
    float r = aoRadius * (0.3 + 0.7 * fract(float(i) * 0.618));
    vec2 o = vec2(cos(a), sin(a)) * r / res;
    float dz = viewZ(vUv + o) - z;
    occ += smoothstep(0.004, 0.012, dz) * (1.0 - smoothstep(0.06, 0.12, dz));
  }
  occ /= 16.0;
  // gestuft wie im Comic / stepped like a comic
  float ao = 1.0 - 0.2 * step(0.45, occ);
  // Innenlinien aus Normalen- und Tiefenspruengen / inner lines from normal and depth jumps
  vec2 px = 1.0 / res;
  vec3 n0 = texture2D(tNormal, vUv).rgb;
  float e = 0.0;
  for (int k = 0; k < 4; k++) {
    vec2 o = k == 0 ? vec2(px.x, 0.0) : k == 1 ? vec2(0.0, px.y) : k == 2 ? vec2(-px.x, 0.0) : vec2(0.0, -px.y);
    vec3 n1 = texture2D(tNormal, vUv + o).rgb;
    e = max(e, step(1.25, length(n1 - n0)));
    e = max(e, step(0.06, abs(viewZ(vUv + o) - z)));
  }
  vec3 col = c.rgb * ao;
  col = mix(col, ink, e * 0.7);
  gl_FragColor = vec4(col, c.a);
  #include <colorspace_fragment>
}`;

/** Dreiecke von Kopfbedeckung und Haar / triangles of headwear and hair */
const casterCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function casterGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let c = casterCache.get(g);
  if (c) return c;
  const p = g.getAttribute('position'), m = g.getAttribute('mtl');
  const out: number[] = [];
  for (let t = 0; t < p.count; t += 3) {
    let top = true, hair = false;
    for (let k = 0; k < 3; k++) {
      if (p.getY(t + k) < 0.79) top = false;
      if (m.getX(t + k) === MTL.hair) hair = true;
    }
    if (top || hair) for (let k = 0; k < 3; k++) out.push(p.getX(t + k), p.getY(t + k), p.getZ(t + k));
  }
  c = new THREE.BufferGeometry();
  c.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  casterCache.set(g, c);
  return c;
}

/**
 * Konturquelle ohne die kleinen Gesichtsteile (Lider, Lippen, Nase): die bekommen ihre feinen Linien aus dem Innenlinien-Pass.
 * Outline source without the small facial parts (lids, lips, nose): they get their fine lines from the inner-line pass.
 */
const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function hullSource(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let c = hullCache.get(g);
  if (c) return c;
  const p = g.getAttribute('position'), m = g.getAttribute('mtl');
  const nTri = Math.min(p.count / 3, g.userData.noHullFrom ?? Infinity);
  // zusammenhaengende Teile ueber gemeinsame Eckpunkte / connected parts via shared corners
  const parent = new Int32Array(nTri).map((_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const seen = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    const t = (i / 3) | 0, o = seen.get(k);
    if (o === undefined) seen.set(k, t);
    else { const a = find(o), b = find(t); if (a !== b) parent[a] = b; }
  }
  const box = new Map<number, number[]>();
  for (let t = 0; t < nTri; t++) {
    const r = find(t);
    let bb = box.get(r);
    if (!bb) { bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9, 0]; box.set(r, bb); }
    for (let k = 0; k < 3; k++) {
      const x = p.getX(t * 3 + k), y = p.getY(t * 3 + k), z = p.getZ(t * 3 + k);
      bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.min(bb[2], z);
      bb[3] = Math.max(bb[3], x); bb[4] = Math.max(bb[4], y); bb[5] = Math.max(bb[5], z);
    }
    if (m.getX(t * 3) === MTL.hair) bb[6] = 1;
  }
  // kleine Gesichtsteile (Lider, Lippen, Tusche) ohne Kontur; Bart und Haar behalten sie
  // small facial parts (lids, lips, ink) without outline; beard and hair keep it
  const drop = (bb: number[]) => {
    const ext = Math.max(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]);
    const cx = (bb[0] + bb[3]) / 2, cy = (bb[1] + bb[4]) / 2, cz = (bb[2] + bb[5]) / 2;
    return !bb[6] && ext < 0.09 && Math.abs(cx) < 0.14 && cy > 0.48 && cy < 0.85 && cz > 0.04;
  };
  const out: number[] = [];
  for (let t = 0; t < nTri; t++) {
    if (drop(box.get(find(t))!)) continue;
    for (let k = 0; k < 3; k++) out.push(p.getX(t * 3 + k), p.getY(t * 3 + k), p.getZ(t * 3 + k));
  }
  c = new THREE.BufferGeometry();
  c.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  hullCache.set(g, c);
  return c;
}

// ---------- Portraet rendern / render a portrait ----------

let gl: THREE.WebGLRenderer | null = null;
function renderer(px: number): THREE.WebGLRenderer {
  if (!gl) {
    gl = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    gl.setClearColor(0x000000, 0);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setPixelRatio(1);
  }
  gl.setSize(px, px, false);
  return gl;
}

function background(ctx: CanvasRenderingContext2D, f: FactionId, S: number) {
  const ft = factionTokens[f];
  const grad = ctx.createRadialGradient(S / 2, S * 0.42, S * 0.08, S / 2, S / 2, S * 0.72);
  grad.addColorStop(0, ft.secondary);
  grad.addColorStop(1, ft.primary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = semantic.white;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(S / 2, S * 0.45);
    ctx.lineTo(S / 2 + Math.cos(a) * S, S * 0.45 + Math.sin(a) * S);
    ctx.lineTo(S / 2 + Math.cos(a + 0.18) * S, S * 0.45 + Math.sin(a + 0.18) * S);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface HDResult { canvas: HTMLCanvasElement; ms: number; buildMs: number; tris: number }

/** Portraet in Spiel-Bildausschnitt rendern / render a portrait in the game framing */
export function renderPortrait(f: FactionId, level: HDLevel, size = 512): HDResult {
  const tb = performance.now();
  const g = hdGeometry(f, level);
  const buildMs = performance.now() - tb;
  const t0 = performance.now();
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const h = box.max.y - box.min.y || 1;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  const cy = box.min.y + h * 0.55;
  cam.position.set(0, cy + h * 0.08, h * 2.55);
  cam.lookAt(0, cy, 0);
  const scene = new THREE.Scene();
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  background(ctx, f, size);

  if (level === 0) {
    // heutiges Spiel-Rendering / today's in-game render
    const r = renderer(size);
    r.shadowMap.enabled = false;
    scene.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.7));
    const sun = new THREE.DirectionalLight(hex(semantic.white), 2.3);
    sun.position.set(1.5, 2.5, 3);
    scene.add(sun);
    const bust = outlined(g, 0.012, unitMaterial());
    bust.rotation.y = -0.28;
    scene.add(bust);
    r.render(scene, cam);
    ctx.drawImage(r.domElement, 0, 0, size, size);
    ctx.getImageData(0, 0, 1, 1);
    return { canvas: out, ms: performance.now() - t0, buildMs, tris: g.attributes.position.count / 3 };
  }

  const SS = 2, px = size * SS;
  const r = renderer(px);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  // Schluessel-, Fuell- und Umgebungslicht / key, fill and ambient light
  scene.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.25));
  const key = new THREE.DirectionalLight(hex(semantic.white), 2.6);
  key.position.set(2.3, 2.4, 1.7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -0.6; key.shadow.camera.right = 0.6; key.shadow.camera.top = 1.2; key.shadow.camera.bottom = -0.2;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 8;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.006;
  key.target.position.set(0, 0.5, 0);
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(hex(semantic.white), 0.55);
  fill.position.set(-2.2, 0.6, 2.2);
  scene.add(fill);
  const mesh = new THREE.Mesh(g, hdMaterial(f, level));
  mesh.receiveShadow = true;
  const bust = new THREE.Group();
  bust.add(mesh);
  // nur Muetze und Haar werfen Schatten (aufs Gesicht), sonst wird es fleckig
  // only headwear and hair cast shadows (onto the face), otherwise it gets blotchy
  const caster = new THREE.Mesh(casterGeometry(g), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  caster.castShadow = true;
  bust.add(caster);
  const hull = outlined(hullSource(g), 0.016).children[1] as THREE.Mesh;
  bust.add(hull);
  bust.rotation.y = -0.28;
  scene.add(bust);

  // Farb- und Normalenpass / colour and normal pass
  const depth = new THREE.DepthTexture(px, px);
  const rtC = new THREE.WebGLRenderTarget(px, px, { depthTexture: depth, samples: 0, type: THREE.HalfFloatType });
  const rtN = new THREE.WebGLRenderTarget(px, px);
  r.setRenderTarget(rtC);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(scene, cam);
  hull.visible = false;
  scene.overrideMaterial = new THREE.MeshNormalMaterial();
  r.setRenderTarget(rtN);
  r.clear();
  r.render(scene, cam);
  scene.overrideMaterial = null;
  hull.visible = true;
  r.setRenderTarget(null);
  // Zusammensetzen / composite
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rtC.texture }, tNormal: { value: rtN.texture }, tDepth: { value: depth },
      res: { value: new THREE.Vector2(px, px) }, near: { value: cam.near }, far: { value: cam.far },
      aoRadius: { value: px * 0.014 }, ink: { value: new THREE.Color(hex(semantic.ink)) },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FRAG,
    transparent: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const ps = new THREE.Scene();
  ps.add(quad);
  const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(ps, oc);
  // Supersampling: halbieren beim Zeichnen / supersampling: halve when drawing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(r.domElement, 0, 0, size, size);
  ctx.getImageData(0, 0, 1, 1);
  rtC.dispose(); rtN.dispose(); depth.dispose(); post.dispose();
  return { canvas: out, ms: performance.now() - t0, buildMs, tris: g.attributes.position.count / 3 };
}

// ---------- Vorschauseite / preview page ----------

declare global {
  interface Window { __renderHD?: (f: FactionId, level: HDLevel, size: number) => { url: string; ms: number; buildMs: number; tris: number }; __ready?: boolean }
}
if (typeof window !== 'undefined' && document.getElementById('leadersHD')) {
  window.__renderHD = (f, level, size) => {
    const res = renderPortrait(f, level, size);
    return { url: res.canvas.toDataURL('image/png'), ms: res.ms, buildMs: res.buildMs, tris: res.tris };
  };
  const params = new URLSearchParams(location.search);
  const f = (params.get('f') ?? 'alvenia') as FactionId;
  const host = document.getElementById('leadersHD')!;
  const levels: HDLevel[] = params.get('level') ? [Number(params.get('level')) as HDLevel] : [0, 1, 2, 3];
  if (params.get('auto') !== '0') for (const lv of levels) {
    const res = renderPortrait(f, lv, Number(params.get('size') ?? 512));
    res.canvas.title = `L${lv}: ${res.tris} tris, ${res.ms.toFixed(0)} ms`;
    host.appendChild(res.canvas);
  }
  window.__ready = true;
}
