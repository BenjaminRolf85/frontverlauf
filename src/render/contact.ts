/**
 * Bodenschatten: dunkle Flecken unter stehender Dekoration (Baeume, Felsen, Pilze: weich) und unter Einheiten (klare
 * Kante, zur Schattenseite versetzt wie der Schlagschatten einer Spielfigur), damit alles auf dem Boden steht, auch bei
 * niedriger Qualitaet ohne Schattenkarte. Je ein instanziertes Netz fuer die Dekoration und fuer die Einheiten (zwei
 * Zeichenaufrufe, zwei Dreiecke je Fleck). Die Flecken dunkeln nur ab (multiplikativ), liegen im deckenden Durchgang
 * vor den Einheiten und werden von allem davor verdeckt; sie ruecken von der Sonne weg (ATMO.uSunXZ) und sind je
 * Tageszeit verschieden stark (ATMO.uContact).
 * Contact shadows: dark blobs under standing decoration (trees, rocks, mushrooms: soft) and under units (a clear edge,
 * shifted to the shaded side like the cast shadow of a game piece) so everything sits on the ground, even on low
 * quality without a shadow map. One instanced mesh each for the decoration and for the units (two draw calls, two
 * triangles per blob). The blobs only darken (multiplicative), run in the opaque pass before the units and are hidden
 * by whatever stands in front; they shift away from the sun (ATMO.uSunXZ) and their strength follows the time of day
 * (ATMO.uContact).
 */
import * as THREE from 'three';
import { ATMO } from './atmosphere';

/**
 * Masse der Flecken in Feldbreiten. shift = Versatz von der Sonne weg in Durchmessern, core = Anteil des Radius mit vollem
 * Schatten (nahe 1 = klare Kante, klein = weicher Verlauf). unit: der Sockel hat Radius 0.36, der Bodenring reicht bis
 * 0.458: sichtbar bleibt eine Sichel auf der Schattenseite. deco: Fleck = Grundriss mal grow,
 * nur fuer Teile, die den Boden beruehren (minY < ground), hoeher als tall und im Grundriss zwischen minR und maxR
 * sind (Gebaeude und Berge sind groesser und bekommen keinen Fleck); cap = Hoechstzahl je Geometrie.
 * Sizes of the blobs in tile widths. shift = offset away from the sun in diameters, core = share of the radius in full
 * shadow (near 1 = a clear edge, small = a soft falloff). unit: the base has radius 0.36, the ground ring reaches
 * 0.458: a crescent stays visible on the shaded side. deco: blob = footprint times grow, only for parts
 * that touch the ground (minY < ground), are taller than tall and whose footprint is between minR and maxR
 * (buildings and mountains are larger and get no blob); cap = maximum per geometry.
 */
export const CONTACT = {
  unit: { radius: 0.55, shift: 0.2, strength: 1.3, core: 0.82 },
  deco: { grow: 1.45, shift: 0.22, strength: 0.7, core: 0.4, ground: 0.05, tall: 0.1, minR: 0.025, maxR: 0.24, axis: 0.045, cap: 14 },
  lift: { deco: 0.022, unit: 0.014 },
  /** Zeichenreihenfolge: nach Boden und Wasser, vor Lichtkegeln und Einheiten / render order: after ground and water, before light pools and units */
  order: 2,
};

export interface Footprint { x: number; z: number; r: number }

const footprintCache = new WeakMap<THREE.BufferGeometry, Footprint[]>();

/**
 * Standflaechen einer Deko-Geometrie: zusammenhaengende Teile finden, Teile auf gleicher Achse (Stamm und Krone)
 * zusammenfassen, dann nach Hoehe und Grundriss filtern. Einmal je Geometrie (gecacht), ohne Zufall.
 * Footprints of a decoration geometry: find connected parts, merge parts on the same axis (trunk and crown), then
 * filter by height and footprint. Once per geometry (cached), no randomness.
 */
export function footprints(geo: THREE.BufferGeometry): Footprint[] {
  const hit = footprintCache.get(geo);
  if (hit) return hit;
  const out: Footprint[] = [];
  footprintCache.set(geo, out);
  const pos = geo.getAttribute('position');
  // Rauch und Wolken stehen nicht auf dem Boden / smoke and clouds do not stand on the ground
  if (!pos || /smoke|cloud/i.test(geo.name)) return out;
  const n = pos.count;
  // Punkte verschweissen / weld vertices
  const ids = new Int32Array(n);
  const seen = new Map<string, number>();
  let welded = 0;
  for (let i = 0; i < n; i++) {
    const key = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    let id = seen.get(key);
    if (id === undefined) { id = welded++; seen.set(key, id); }
    ids[i] = id;
  }
  const parent = new Int32Array(welded).map((_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const index = geo.index;
  const corners = index ? index.count : n;
  for (let i = 0; i + 2 < corners; i += 3) {
    const a = find(ids[index ? index.getX(i) : i]), b = find(ids[index ? index.getX(i + 1) : i + 1]), c = find(ids[index ? index.getX(i + 2) : i + 2]);
    parent[b] = a; parent[find(c)] = a;
  }
  interface Part { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
  const grow = (p: Part, x: number, y: number, z: number) => {
    p.x0 = Math.min(p.x0, x); p.x1 = Math.max(p.x1, x); p.y0 = Math.min(p.y0, y); p.y1 = Math.max(p.y1, y); p.z0 = Math.min(p.z0, z); p.z1 = Math.max(p.z1, z);
  };
  const empty = (): Part => ({ x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity });
  const parts = new Map<number, Part>();
  for (let i = 0; i < n; i++) {
    const root = find(ids[i]);
    let p = parts.get(root);
    if (!p) { p = empty(); parts.set(root, p); }
    grow(p, pos.getX(i), pos.getY(i), pos.getZ(i));
  }
  // Teile auf gleicher Achse zu einem Gegenstand / parts on the same axis form one object
  const d = CONTACT.deco;
  const objects: Part[] = [];
  const cx = (p: Part) => (p.x0 + p.x1) / 2, cz = (p: Part) => (p.z0 + p.z1) / 2;
  // feste Reihenfolge: von unten nach oben / fixed order: bottom to top
  for (const p of [...parts.values()].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0 || a.z0 - b.z0)) {
    const o = objects.find((q) => Math.hypot(cx(q) - cx(p), cz(q) - cz(p)) < d.axis && p.y0 < q.y1 + 0.06);
    if (o) { grow(o, p.x0, p.y0, p.z0); grow(o, p.x1, p.y1, p.z1); } else objects.push({ ...p });
  }
  for (const o of objects) {
    const hx = (o.x1 - o.x0) / 2, hz = (o.z1 - o.z0) / 2;
    const r = Math.max(hx, hz);
    // laengliche Teile (Zaeune, Balken) bekommen keinen runden Fleck / elongated parts (fences, beams) get no round blob
    if (o.y0 > d.ground || o.y1 - o.y0 < d.tall || r < d.minR || r > d.maxR || Math.min(hx, hz) < r * 0.45) continue;
    out.push({ x: cx(o), z: cz(o), r });
  }
  out.sort((a, b) => b.r - a.r);
  out.length = Math.min(out.length, d.cap);
  return out;
}

let blobMat: THREE.ShaderMaterial | null = null;
/** Material der Flecken: dunkelt den Boden ab, aendert nie Alpha / blob material: darkens the ground, never changes alpha */
function blobMaterial(): THREE.ShaderMaterial {
  if (blobMat) return blobMat;
  blobMat = new THREE.ShaderMaterial({
    uniforms: { uSunXZ: ATMO.uSunXZ, uContact: ATMO.uContact, uHalf: ATMO.uHazeHalf },
    vertexShader: /* glsl */ `
      // x = Versatz, y = Staerke, z = Kern (Anteil des Radius mit vollem Schatten) / x = shift, y = strength, z = core (share of the radius in full shadow)
      attribute vec3 blob;
      uniform vec2 uSunXZ;
      varying vec2 vUv;
      varying vec2 vBoard;
      varying vec2 vShape;
      void main() {
        vUv = uv;
        vShape = blob.yz;
        // vom Licht weg verschieben, in Durchmessern / shift away from the light, in diameters
        vec4 p = vec4(position, 1.0);
        p.xz -= uSunXZ * blob.x;
        p = instanceMatrix * p;
        vBoard = p.xz;
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uContact;
      uniform float uHalf;
      varying vec2 vUv;
      varying vec2 vBoard;
      varying vec2 vShape;
      void main() {
        // nie ueber den Brettrand hinaus / never beyond the edge of the board
        if (max(abs(vBoard.x), abs(vBoard.y)) > uHalf) discard;
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(vShape.y, 1.0, d);
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * vShape.x * uContact);
      }`,
    // nicht 'transparent': laeuft im deckenden Durchgang vor dem Tiefen-Loeschen fuer Einheiten (wie die Lichtkegel)
    // not 'transparent': runs in the opaque pass before the depth clear for units (like the light pools)
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  return blobMat;
}

/** Ein instanziertes Netz aus Flecken / one instanced mesh of blobs */
class BlobMesh {
  mesh: THREE.InstancedMesh | null = null;
  private attr: THREE.InstancedBufferAttribute | null = null;
  private capacity = 0;
  private tmp = new THREE.Matrix4();

  constructor(private group: THREE.Group, private plane: THREE.BufferGeometry, private look: { shift: number; strength: number; core: number }) {}

  /** Platz fuer count Flecken schaffen / make room for count blobs */
  reserve(count: number) {
    if (count <= this.capacity && this.mesh) return;
    this.dispose();
    this.capacity = Math.max(16, Math.ceil(count * 1.5));
    // eigene Geometrie je Netz: das Instanzattribut haengt an ihr / own geometry per mesh: it carries the instance attribute
    const g = this.plane.clone();
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3);
    g.setAttribute('blob', this.attr);
    const m = new THREE.InstancedMesh(g, blobMaterial(), this.capacity);
    m.count = 0;
    m.raycast = () => {};
    m.frustumCulled = false;
    m.renderOrder = CONTACT.order;
    this.mesh = m;
    this.group.add(m);
  }

  /** Fleck i setzen (r = Radius; k = Anteil der Staerke) / set blob i (r = radius; k = share of the strength) */
  set(i: number, x: number, y: number, z: number, r: number, k = 1) {
    this.tmp.makeScale(r * 2, 1, r * 2).setPosition(x, y, z);
    this.mesh!.setMatrixAt(i, this.tmp);
    this.attr!.setXYZ(i, this.look.shift, this.look.strength * k, this.look.core);
  }

  commit(count: number) {
    if (!this.mesh) return;
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.attr!.needsUpdate = true;
  }

  dispose() {
    if (!this.mesh) return;
    this.group.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.mesh = null; this.attr = null; this.capacity = 0;
  }
}

export class ContactShadows {
  readonly group = new THREE.Group();
  private plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private deco = new BlobMesh(this.group, this.plane, CONTACT.deco);
  private units = new BlobMesh(this.group, this.plane, CONTACT.unit);
  private v = new THREE.Vector3();

  /**
   * Flecken der Dekoration aus den Instanzlisten des Bretts (Geometrie -> Matrizen). Dekoration auf Wasser (Bojen,
   * Fische) bekommt keinen Fleck.
   * Blobs of the decoration from the instance lists of the board (geometry -> matrices). Decoration on water (buoys,
   * fish) gets no blob.
   */
  buildDeco(lists: Iterable<[THREE.BufferGeometry, THREE.Matrix4[]]>[]) {
    const blobs: number[] = [];
    for (const list of lists) for (const [geo, mats] of list) {
      const fps = footprints(geo);
      if (!fps.length) continue;
      for (const m of mats) {
        const e = m.elements;
        // Hoehe der Instanz: unter der Landoberflaeche = Wasser / height of the instance: below the land surface = water
        if (e[13] < -0.01) continue;
        const scale = Math.hypot(e[0], e[1], e[2]);
        for (const f of fps) {
          this.v.set(f.x, 0, f.z).applyMatrix4(m);
          blobs.push(this.v.x, this.v.y + CONTACT.lift.deco, this.v.z, f.r * scale * CONTACT.deco.grow);
        }
      }
    }
    const count = blobs.length / 4;
    if (count) this.deco.reserve(count);
    for (let i = 0; i < count; i++) this.deco.set(i, blobs[i * 4], blobs[i * 4 + 1], blobs[i * 4 + 2], blobs[i * 4 + 3]);
    this.deco.commit(count);
  }

  /** Flecken der Einheiten: erst Platz schaffen, dann je Einheit setzen, dann abschliessen / unit blobs: reserve first, then set per unit, then commit */
  beginUnits(max: number) { if (max > 0) this.units.reserve(max); }
  /** scale = Schrumpfen beim Sterben / scale = shrinking while dying */
  unit(i: number, p: THREE.Vector3, scale: number) { this.units.set(i, p.x, p.y + CONTACT.lift.unit, p.z, CONTACT.unit.radius * scale, scale); }
  endUnits(count: number) { this.units.commit(count); }

  get count() { return (this.deco.mesh?.count ?? 0) + (this.units.mesh?.count ?? 0); }
}
