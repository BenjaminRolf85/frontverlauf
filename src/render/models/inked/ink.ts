/**
 * Gezeichnete Einheiten: Tusche als Geometrie / inked units: ink as geometry.
 *
 * Eine Geometrie, ein Material, EIN Zeichenaufruf (wie bisher die Kontur), aber zwei Arten Linien:
 * - Umriss: umgestuelpte Huelle wie in toon.ts, die Breite schwankt entlang der Flaeche wie ein Federstrich.
 * - Innenlinien: jede Knickkante (Flaechenwinkel ueber der Schwelle) und jede offene Kante wird ein schmales Band,
 *   das der Shader im Bildraum auffaechert. Die Breite laeuft an freien Enden aus und schwankt von Knoten zu Knoten.
 *   Im Brettmassstab fallen die duennsten Baender weg (sie waeren unter einem Pixel).
 * One geometry, one material, ONE draw call (like the outline before), but two kinds of lines:
 * - silhouette: inverted hull as in toon.ts, its width wavers along the surface like a nib stroke.
 * - inner lines: every crease edge (dihedral angle above the threshold) and every open edge becomes a narrow ribbon the
 *   shader fans out in screen space. The width tapers at free ends and varies from node to node. At board scale the
 *   thinnest ribbons drop out (they would be below one pixel).
 */
import * as THREE from 'three';
import { hex, semantic } from '../../../design/tokens';

export interface InkOpts {
  /** Flaechenwinkel in Grad, ab dem eine Kante gezeichnet wird / dihedral angle in degrees from which an edge is drawn */
  angle?: number;
  /** false: nur der Umriss, keine Innenlinien (niedrige Qualitaet) / false: silhouette only, no inner lines (low quality) */
  creases?: boolean;
}

/** Fester Streuwert aus einer Zahl / fixed hash from a number */
const hash = (i: number) => {
  let t = (i + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Tuschegeometrie aus einer nicht-indizierten Modellgeometrie (position, optional fx.y = Gewicht der Knicklinien).
 * Attribute: position, normal (Huelle: geglaettete Normale; Band: Vektor zum anderen Kantenende), ink (Seite, Ende, Gewicht).
 * Ink geometry from a non-indexed model geometry (position, optional fx.y = crease weight). Attributes: position,
 * normal (hull: smoothed normal; ribbon: vector to the other edge end), ink (side, end, weight).
 */
export function inkGeometry(src: THREE.BufferGeometry, o: InkOpts = {}): THREE.BufferGeometry {
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  const fx = src.getAttribute('fx') as THREE.BufferAttribute | undefined;
  const cosMin = Math.cos(((o.angle ?? 38) * Math.PI) / 180);
  // Ecken verschweissen / weld vertices
  const ids = new Map<string, number>();
  const P: number[] = [];
  const vid = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const key = `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
    let id = ids.get(key);
    if (id === undefined) { id = P.length / 3; ids.set(key, id); P.push(x, y, z); }
    vid[i] = id;
  }
  const nv = P.length / 3;
  const N = new Float32Array(nv * 3);
  const index: number[] = [];
  // Kanten mit ihren Flaechennormalen / edges with their face normals
  const edges = new Map<number, { a: number; b: number; n: number[]; w: number }>();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (let t = 0; t < pos.count; t += 3) {
    const a = vid[t], b = vid[t + 1], c = vid[t + 2];
    if (a === b || b === c || c === a) continue;
    e1.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
    e2.set(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
    fn.crossVectors(e1, e2);
    if (fn.lengthSq() < 1e-20) continue;
    index.push(a, b, c);
    // flaechengewichtet wie computeVertexNormals / area weighted like computeVertexNormals
    for (const v of [a, b, c]) { N[v * 3] += fn.x; N[v * 3 + 1] += fn.y; N[v * 3 + 2] += fn.z; }
    fn.normalize();
    const w = fx ? Math.min(fx.getY(t), fx.getY(t + 1), fx.getY(t + 2)) : 1;
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const lo = Math.min(p, q), hi = Math.max(p, q), key = lo * nv + hi;
      let e = edges.get(key);
      if (!e) { e = { a: lo, b: hi, n: [], w }; edges.set(key, e); }
      e.n.push(fn.x, fn.y, fn.z);
      e.w = Math.min(e.w, w);
    }
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1;
    N[v * 3] /= l; N[v * 3 + 1] /= l; N[v * 3 + 2] /= l;
  }
  // Knickkanten auswaehlen / pick the crease edges
  const creases: { a: number; b: number; w: number }[] = [];
  const degree = new Uint16Array(nv);
  for (const e of edges.values()) {
    if (e.w <= 0 || o.creases === false) continue;
    const k = e.n.length / 3;
    let w = 0;
    if (k === 1) w = 1;
    else {
      let minDot = 1;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) minDot = Math.min(minDot, e.n[i * 3] * e.n[j * 3] + e.n[i * 3 + 1] * e.n[j * 3 + 1] + e.n[i * 3 + 2] * e.n[j * 3 + 2]);
      if (minDot < cosMin) w = minDot < 0.35 ? 1 : 0.72;
    }
    if (w <= 0) continue;
    creases.push({ a: e.a, b: e.b, w: w * e.w });
    degree[e.a]++; degree[e.b]++;
  }
  const hullCount = nv;
  const total = hullCount + creases.length * 4;
  const position = new Float32Array(total * 3), normal = new Float32Array(total * 3), ink = new Float32Array(total * 3);
  position.set(P);
  normal.set(N);
  // Huelle: ink = (0, 0, Streuwert) / hull: ink = (0, 0, hash)
  for (let v = 0; v < nv; v++) ink[v * 3 + 2] = hash(v);
  // Knoten: freie Enden laufen aus, sonst schwankt das Gewicht / nodes: free ends taper, otherwise the weight varies
  const node = (v: number) => (degree[v] === 1 ? 0.2 : 0.7 + 0.6 * hash(v * 31 + 7));
  let o4 = hullCount;
  for (const c of creases) {
    for (const [self, other, end] of [[c.a, c.b, 1], [c.b, c.a, -1]] as const) {
      for (const side of [-1, 1]) {
        position.set([P[self * 3], P[self * 3 + 1], P[self * 3 + 2]], o4 * 3);
        normal.set([P[other * 3] - P[self * 3], P[other * 3 + 1] - P[self * 3 + 1], P[other * 3 + 2] - P[self * 3 + 2]], o4 * 3);
        ink.set([side, end, c.w * node(self)], o4 * 3);
        o4++;
      }
    }
    // Ecken: (a,-) (a,+) (b,-) (b,+); im Bild immer gleich gewickelt (siehe Shader) / on screen always wound alike (see shader)
    const q = o4 - 4;
    index.push(q, q + 1, q + 3, q, q + 3, q + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  g.setAttribute('ink', new THREE.BufferAttribute(ink, 3));
  g.setIndex(index);
  g.userData.creases = creases.length;
  g.userData.hullTriangles = (index.length - creases.length * 6) / 3;
  src.computeBoundingSphere();
  g.boundingSphere = src.boundingSphere!.clone();
  g.boundingSphere.radius += 0.05;
  g.boundingBox = src.boundingBox ? src.boundingBox.clone() : null;
  return g;
}

const inkCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
/**
 * Tuschegeometrie zu einer Einheitengeometrie (zwischengespeichert). Gezeichnete Einheiten merken in userData.inkSrc
 * ihre ungeteilte Rohgeometrie: aus ihr entsteht die Tusche, damit die Unterteilung fuer die Verdeckung sie nicht aufblaeht.
 * Ink geometry for a unit geometry (cached). Inked units remember their unsubdivided raw geometry in userData.inkSrc:
 * the ink is made from it so the subdivision for the occlusion does not inflate it.
 */
export function inkFor(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let ink = inkCache.get(g);
  if (!ink) {
    ink = inkGeometry((g.userData.inkSrc as THREE.BufferGeometry | undefined) ?? g, { creases: (g.userData.inked as { creases?: boolean } | undefined)?.creases !== false });
    inkCache.set(g, ink);
  }
  return ink;
}

/**
 * Bildgroesse und Pixeldichte des gerade zeichnenden Renderers; syncView setzt sie vor jedem Zeichnen (Brett, Portrait
 * und Vorschau haben eigene Renderer). Tusche und Schraffur teilen sich die Werte.
 * Viewport size and pixel ratio of the renderer drawing right now; syncView sets them before every draw (board,
 * portrait and preview have their own renderers). Ink and hatching share the values.
 */
export const VIEW = { uView: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 } };
const vp = new THREE.Vector4();
/** Als mesh.onBeforeRender einhaengen / hook up as mesh.onBeforeRender */
export function syncView(renderer: THREE.WebGLRenderer): void {
  renderer.getCurrentViewport(vp);
  VIEW.uView.value.set(vp.z, vp.w);
  VIEW.uDpr.value = renderer.getPixelRatio();
}

/** Schalter fuer die Vorschau: Schwankung der Strichstaerke, Innenlinien / switches for the preview: line weight variation, inner lines */
export const INK = { uIrregular: { value: 1 }, uCreaseOn: { value: 1 } };
/** halbe Breite der Innenlinien in Modelleinheiten / half width of the inner lines in model units */
export const CREASE_HALF_WIDTH = 0.0021;
/** groesste Umrissbreite in CSS-Pixeln: in der Nahansicht quillt die Linie nicht auf / largest silhouette width in CSS pixels: the line does not swell in a close view */
export const OUTLINE_MAX_PX = 2.9;

const inkMats = new Map<number, THREE.ShaderMaterial>();
/** Tuschematerial: Umriss (Breite in Modelleinheiten wie outlineMaterial) und Innenlinien in einem Durchgang / ink material: silhouette (width in model units like outlineMaterial) and inner lines in one pass */
export function inkMaterial(width = 0.018): THREE.ShaderMaterial {
  let m = inkMats.get(width);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: width }, uCrease: { value: CREASE_HALF_WIDTH }, uMaxPx: { value: OUTLINE_MAX_PX },
      uColor: { value: new THREE.Color(hex(semantic.ink)) },
      uView: VIEW.uView, uDpr: VIEW.uDpr, uIrregular: INK.uIrregular, uCreaseOn: INK.uCreaseOn,
    },
    vertexShader: /* glsl */ `
      uniform float uWidth, uCrease, uDpr, uIrregular, uCreaseOn, uMaxPx;
      uniform vec2 uView;
      attribute vec3 ink;
      float bHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float bNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(bHash(i), bHash(i + vec3(1, 0, 0)), f.x), mix(bHash(i + vec3(0, 1, 0)), bHash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(bHash(i + vec3(0, 0, 1)), bHash(i + vec3(1, 0, 1)), f.x), mix(bHash(i + vec3(0, 1, 1)), bHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
      }
      void main() {
        float scale = length(modelViewMatrix[0].xyz);
        if (ink.x == 0.0) {
          // Umriss: Breite schwankt entlang der Flaeche / silhouette: the width wavers along the surface
          float n = bNoise(position * 34.0) * 0.65 + bNoise(position * 11.0) * 0.35;
          float w = uWidth * (1.0 + uIrregular * (n - 0.5) * 1.5);
          vec4 cp = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // nie duenner als gut ein halbes Pixel, nie breiter als uMaxPx / never thinner than a good half pixel, never wider than uMaxPx
          float ppu = projectionMatrix[1][1] * uView.y * 0.5 / cp.w * scale;
          w = clamp(w, 0.55 * uDpr / ppu, uMaxPx * uDpr / ppu);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * w, 1.0);
        } else {
          vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + normal, 1.0);
          vec2 s0 = c0.xy / c0.w * uView * 0.5, s1 = c1.xy / c1.w * uView * 0.5;
          vec2 d = s1 - s0;
          float len = length(d);
          d = (len > 1e-4 ? d / len : vec2(1.0, 0.0)) * ink.y;
          vec2 nrm = vec2(-d.y, d.x);
          float ppu = projectionMatrix[1][1] * uView.y * 0.5 / c0.w * scale;
          float wpx = uCrease * mix(1.0, ink.z, uIrregular) * ppu / uDpr;
          // Beim Herauszoomen wird die Linie stufenlos schmaler und verschwindet, statt zu springen
          // when zooming out the line narrows steplessly and vanishes instead of popping
          wpx = max(wpx, 0.5) * smoothstep(0.16, 0.62, wpx) * uCreaseOn * uDpr;
          vec2 off = nrm * ink.x * wpx - d * ink.y * wpx * 0.7;
          gl_Position = c0;
          gl_Position.xy += off / (uView * 0.5) * c0.w;
          // knapp vor die Flaeche / just in front of the surface
          gl_Position.z -= 0.0035 * scale * abs(projectionMatrix[2][2]);
        }
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
  inkMats.set(width, m);
  return m;
}
