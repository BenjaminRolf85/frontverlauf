/**
 * Vorschlag C: modellierte Einheiten als glTF laden und im Comic-Look des Spiels zeichnen.
 * Proposal C: load the modelled units as glTF and draw them in the game's comic look.
 *
 * Aufbau der Datei (.glb, Meshopt-komprimiert, gebaut von tools/models/build.py):
 * - EIN Mesh mit Skelett; Farbrolle je Flaeche als UV in die Palette (palette.ts); COLOR_0: R = Verdeckungslicht,
 *   G = Strichstaerke der Tuschelinie; Clips als glTF-Animationen; Panzerkette als Morphziel.
 * File layout (.glb, meshopt compressed, built by tools/models/build.py):
 * - ONE mesh with a skeleton; per-face colour role as a UV into the palette (palette.ts); COLOR_0: R = ambient
 *   occlusion, G = ink line weight; clips as glTF animations; tank track as a morph target.
 *
 * Gezeichnet wird mit dem Einheitenmaterial des Spiels (unitMaterial aus toon.ts, gleiche Stufentextur) plus Palette,
 * die Tuschelinie als umgedrehte Huelle wie in toon.ts, hier mit Skelett, Morphzielen und Strichstaerke je Vertex.
 * Drawn with the game's unit material (unitMaterial from toon.ts, same step texture) plus the palette; the ink line is
 * an inverted hull as in toon.ts, here with skeleton, morph targets and a per-vertex line weight.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FactionId } from '../../../../data/balance';
import { hex, semantic } from '../../../../design/tokens';
import { unitMaterial } from '../../../toon';
import type { TurretRange } from '../../kit';
import { PALETTE_SIZE, paletteColors, paletteTexture } from './palette';

export interface UnitAsset {
  name: string;
  /** Wurzel mit Skelett und Mesh / root with skeleton and mesh */
  scene: THREE.Object3D;
  geometry: THREE.BufferGeometry;
  clips: THREE.AnimationClip[];
  /** Dateigroesse / file size */
  bytes: number;
  triangles: number;
  vertices: number;
  bones: number;
  /**
   * Modell-Einheiten je Einheit der gespeicherten Positionen (die Kompression quantisiert die Positionen und legt den
   * Massstab ins Skelett); noetig fuer die Breite der Tuschelinie.
   * Model units per unit of the stored positions (the compression quantises positions and puts the scale into the
   * skeleton); needed for the width of the ink line.
   */
  unit: number;
  /** Laden + Entpacken + Aufbereiten in ms / load + decode + prepare in ms */
  loadMs: number;
  /** davon ohne Netz (Entpacken, Aufbereiten) / thereof without the network (decode, prepare) */
  parseMs: number;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

/** Einheit laden; jede Datei wird nur einmal geholt (so laesst sich je Einheitentyp nachladen) / load a unit; each file is fetched once only (this is how unit types can be lazy-loaded) */
const cache = new Map<string, Promise<UnitAsset>>();
export function loadUnitAsset(url: string): Promise<UnitAsset> {
  let p = cache.get(url);
  if (!p) {
    p = fetchAsset(url);
    cache.set(url, p);
  }
  return p;
}

async function fetchAsset(url: string): Promise<UnitAsset> {
  const t0 = performance.now();
  const buf = await (await fetch(url)).arrayBuffer();
  const t1 = performance.now();
  const gltf = await loader.parseAsync(buf, '');
  let mesh: THREE.SkinnedMesh | null = null;
  gltf.scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  if (!mesh) throw new Error(`no skinned mesh in ${url}`);
  const sm = mesh as THREE.SkinnedMesh;
  prepareGeometry(sm.geometry);
  const unit = storedUnit(gltf.scene, sm);
  const t2 = performance.now();
  return {
    name: url.split('/').pop() ?? url,
    scene: gltf.scene,
    geometry: sm.geometry,
    clips: gltf.animations.map((c) => slimClip(c, gltf.scene)),
    bytes: buf.byteLength,
    triangles: sm.geometry.index!.count / 3,
    vertices: sm.geometry.getAttribute('position').count,
    bones: sm.skeleton.bones.length,
    unit,
    loadMs: t2 - t0,
    parseMs: t2 - t1,
  };
}

/** Massstab der gespeicherten Positionen: Abstand zweier Punkte nach dem Skelett geteilt durch den gespeicherten / scale of the stored positions: distance of two points after skinning divided by the stored one */
function storedUnit(scene: THREE.Object3D, mesh: THREE.SkinnedMesh): number {
  scene.updateMatrixWorld(true);
  mesh.skeleton.update();
  const pos = mesh.geometry.getAttribute('position');
  let lo = 0, hi = 0;
  for (let i = 1; i < pos.count; i++) {
    if (pos.getY(i) < pos.getY(lo)) lo = i;
    if (pos.getY(i) > pos.getY(hi)) hi = i;
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3();
  mesh.getVertexPosition(lo, a).applyMatrix4(mesh.matrixWorld);
  mesh.getVertexPosition(hi, b).applyMatrix4(mesh.matrixWorld);
  la.fromBufferAttribute(pos, lo);
  lb.fromBufferAttribute(pos, hi);
  return a.distanceTo(b) / Math.max(1e-9, la.distanceTo(lb));
}

/**
 * Clip entschlacken: Spuren ohne Bewegung in Ruhelage fallen weg (der Export schreibt je Knochen Ort, Drehung und
 * Massstab), ebenso die Drehung des Turmknochens, denn den Turm dreht das Spiel selbst.
 * Slim a clip: tracks without motion at the rest pose are dropped (the export writes location, rotation and scale per
 * bone), and so is the rotation of the turret bone because the game turns the turret itself.
 */
function slimClip(clip: THREE.AnimationClip, scene: THREE.Object3D): THREE.AnimationClip {
  const rest = (node: THREE.Object3D, prop: string): number[] | null =>
    prop === 'position' ? node.position.toArray() : prop === 'scale' ? node.scale.toArray() : prop === 'quaternion' ? node.quaternion.toArray() : null;
  clip.tracks = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf('.');
    const name = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    if (name === TURRET_BONE && prop === 'quaternion') return false;
    const node = scene.getObjectByName(name);
    const r = node ? rest(node, prop) : null;
    if (!r) return true;
    const size = t.getValueSize();
    for (let i = 0; i < t.values.length; i++) if (Math.abs(t.values[i] - r[i % size]) > 1e-4) return true;
    return false;
  });
  return clip;
}
/** Knochen, den das Spiel dreht / bone the game rotates */
export const TURRET_BONE = 'turret';

/**
 * Konturnormale je Vertex (ueber gleiche Orte gemittelt, damit die Huelle an harten Kanten nicht aufreisst) und
 * Strichstaerke aus dem Gruenkanal der Vertexfarbe.
 * Outline normal per vertex (averaged over coincident locations so the hull does not tear at hard edges) and the line
 * weight from the green channel of the vertex colour.
 */
function prepareGeometry(g: THREE.BufferGeometry): void {
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), colr = g.getAttribute('color');
  const n = pos.count;
  const sum = new Map<string, [number, number, number]>();
  const keys: string[] = new Array(n);
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    w.fromBufferAttribute(nor, i);
    const k = `${Math.round(v.x * 4096)},${Math.round(v.y * 4096)},${Math.round(v.z * 4096)}`;
    keys[i] = k;
    const s = sum.get(k);
    if (s) { s[0] += w.x; s[1] += w.y; s[2] += w.z; } else sum.set(k, [w.x, w.y, w.z]);
  }
  const out = new Float32Array(n * 3), weight = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = sum.get(keys[i])!;
    w.set(s[0], s[1], s[2]).normalize();
    out.set([w.x, w.y, w.z], i * 3);
    weight[i] = colr ? colr.getY(i) : 1;
  }
  g.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  g.setAttribute('lineWeight', new THREE.BufferAttribute(weight, 1));
}

const toonMats = new Map<string, THREE.MeshToonMaterial>();
/**
 * Einheitenmaterial des Spiels mit Palette der Fraktion; vom Farbattribut zaehlt nur R (Verdeckungslicht).
 * The game's unit material with the faction palette; of the colour attribute only R counts (ambient occlusion).
 */
export function assetMaterial(f: FactionId, dim = false): THREE.MeshToonMaterial {
  const key = `${f}-${dim ? 1 : 0}`;
  let m = toonMats.get(key);
  if (!m) {
    m = unitMaterial({ dim }).clone();
    m.map = paletteTexture(f);
    m.vertexColors = true;
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.r;');
    };
    m.customProgramCacheKey = () => 'proto-c-unit';
    toonMats.set(key, m);
  }
  return m;
}

/** Anteil der Linienbreite, um den die Huelle in die Tiefe rueckt / share of the line width by which the hull moves back in depth */
const LINE_PUSH = 0.6;
const lineMats = new Map<string, THREE.MeshBasicMaterial>();
/**
 * Tuschelinie fuer Skelett-Meshes: umgedrehte Huelle, Breite in Modell-Einheiten mal Strichstaerke des Vertex.
 * Ink line for skinned meshes: inverted hull, width in model units times the vertex line weight.
 */
export function assetOutline(width: number, push = 0): THREE.MeshBasicMaterial {
  const key = `${width.toFixed(5)}-${push.toFixed(5)}`;
  let m = lineMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: hex(semantic.ink), side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uWidth = { value: width };
      shader.uniforms.uPush = { value: push };
      // Huelle um uPush nach hinten schieben: sie zeigt sich am Umriss und vor entfernten Teilen, sticht aber in Kehlen
      // nicht mehr als Zacken durch die eigene Flaeche
      // push the hull back by uPush: it shows at the silhouette and in front of distant parts but no longer pokes through
      // its own surface as spikes in creases
      shader.vertexShader = 'attribute vec3 outlineNormal;\nattribute float lineWeight;\nuniform float uWidth;\nuniform float uPush;\n'
        + shader.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += outlineNormal * (uWidth * lineWeight);')
          .replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position.z -= projectionMatrix[2][2] * uPush * gl_Position.w;');
    };
    m.customProgramCacheKey = () => `proto-c-line-${key}`;
    lineMats.set(key, m);
  }
  return m;
}

export interface UnitInstance {
  root: THREE.Object3D;
  mesh: THREE.SkinnedMesh;
  line: THREE.SkinnedMesh;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  /** Knochen nach Namen (z. B. 'turret' zum Drehen) / bones by name (e.g. 'turret' to rotate) */
  bone(name: string): THREE.Bone | undefined;
  /** Clip weich einblenden / cross-fade to a clip */
  play(name: string, fade?: number): void;
}

/**
 * Spielbare Kopie: eigenes Skelett, geteilte Geometrie. scale = Modell-Einheiten -> Feldbreiten, lineWidth in
 * Feldbreiten wie OUTLINE.unit. 2 Zeichenaufrufe (Flaeche + Linie).
 * Playable copy: own skeleton, shared geometry. scale = model units -> tile widths, lineWidth in tile widths like
 * OUTLINE.unit. 2 draw calls (surface + line).
 */
export function instantiate(asset: UnitAsset, f: FactionId, scale: number, lineWidth: number): UnitInstance {
  const root = cloneSkinned(asset.scene);
  let mesh!: THREE.SkinnedMesh;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh = o as THREE.SkinnedMesh;
  });
  mesh.material = assetMaterial(f);
  mesh.frustumCulled = false;
  const line = new THREE.SkinnedMesh(mesh.geometry, assetOutline(lineWidth / (scale * asset.unit), lineWidth * LINE_PUSH));
  line.bind(mesh.skeleton, mesh.bindMatrix);
  line.frustumCulled = false;
  line.raycast = () => {};
  line.position.copy(mesh.position);
  line.quaternion.copy(mesh.quaternion);
  line.scale.copy(mesh.scale);
  // Morphziele teilen: der Mixer bewegt beide / share the morph targets: the mixer moves both
  if (mesh.morphTargetInfluences) {
    line.morphTargetInfluences = mesh.morphTargetInfluences;
    line.morphTargetDictionary = mesh.morphTargetDictionary;
  }
  mesh.parent!.add(line);
  root.scale.setScalar(scale);
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map<string, THREE.AnimationAction>();
  for (const c of asset.clips) actions.set(c.name, mixer.clipAction(c));
  let current: THREE.AnimationAction | null = null;
  return {
    root, mesh, line, mixer, actions,
    bone: (name) => mesh.skeleton.bones.find((b) => b.name === name),
    play(name, fade = 0.25) {
      const next = actions.get(name);
      if (!next || next === current) return;
      next.reset().play();
      if (current) current.crossFadeTo(next, fade, false);
      current = next;
    },
  };
}

/**
 * Pose einbrennen: aus der aktuellen Haltung eine gewoehnliche Geometrie mit Vertexfarben machen (position, normal,
 * color), so wie unitGeometry() sie liefert. Damit laufen Brett, Instanzierung, Drehturm-Zerlegung (userData.turrets)
 * und der Introfilm-Export unveraendert. turretBones: Knochen, deren Dreiecke als Drehturm ans Ende wandern.
 * Bake a pose: turn the current pose into an ordinary geometry with vertex colours (position, normal, color), just as
 * unitGeometry() returns it. Board, instancing, turret split (userData.turrets) and the intro film export then run
 * unchanged. turretBones: bones whose triangles move to the end as the turret.
 */
export function bakePose(inst: UnitInstance, f: FactionId, turretBones: string[] = [], pivotBone?: string): THREE.BufferGeometry {
  const { mesh, root } = inst;
  root.updateMatrixWorld(true);
  mesh.skeleton.update();
  const g = mesh.geometry;
  const index = g.index!, pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv'), colr = g.getAttribute('color');
  const skinIndex = g.getAttribute('skinIndex'), skinWeight = g.getAttribute('skinWeight');
  const n = pos.count;
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  toRoot.premultiply(new THREE.Matrix4().makeScale(root.scale.x, root.scale.y, root.scale.z));
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const turret = new Uint8Array(n);
  const tb = new Set(turretBones.map((b) => mesh.skeleton.bones.findIndex((x) => x.name === b)));
  const pal = paletteColors(f);
  const v = new THREE.Vector3(), w = new THREE.Vector3(), base = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    mesh.getVertexPosition(i, v);
    // Normale: einen entlang der Normale verschobenen Punkt mit denselben Knochen bewegen
    // normal: move a point displaced along the normal with the same bones
    base.fromBufferAttribute(pos, i);
    nrm.fromBufferAttribute(nor, i);
    w.copy(base).addScaledVector(nrm, 0.01);
    mesh.applyBoneTransform(i, base);
    mesh.applyBoneTransform(i, w);
    w.sub(base).transformDirection(toRoot);
    v.applyMatrix4(toRoot);
    P.set([v.x, v.y, v.z], i * 3);
    N.set([w.x, w.y, w.z], i * 3);
    const c = pal[Math.min(PALETTE_SIZE - 1, Math.floor(uv.getX(i) * PALETTE_SIZE))];
    const ao = colr.getX(i);
    C.set([c.r * ao, c.g * ao, c.b * ao], i * 3);
    // Turmzugehoerigkeit: staerkster Knochen / turret membership: strongest bone
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const wk = skinWeight.getComponent(i, k);
      if (wk > bw) { bw = wk; best = skinIndex.getComponent(i, k); }
    }
    turret[i] = tb.has(best) ? 1 : 0;
  }
  const tris = index.count / 3;
  const order: number[] = [];
  let hullTris = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let t = 0; t < tris; t++) {
      const a = index.getX(t * 3);
      if (turret[a] === pass) order.push(t);
    }
    if (pass === 0) hullTris = order.length;
  }
  const op = new Float32Array(tris * 9), on = new Float32Array(tris * 9), oc = new Float32Array(tris * 9);
  order.forEach((t, k) => {
    for (let j = 0; j < 3; j++) {
      const i = index.getX(t * 3 + j);
      op.set(P.subarray(i * 3, i * 3 + 3), k * 9 + j * 3);
      on.set(N.subarray(i * 3, i * 3 + 3), k * 9 + j * 3);
      oc.set(C.subarray(i * 3, i * 3 + 3), k * 9 + j * 3);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(op, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(on, 3));
  out.setAttribute('color', new THREE.BufferAttribute(oc, 3));
  if (turretBones.length && hullTris < tris) {
    const piv = new THREE.Vector3();
    inst.bone(pivotBone ?? turretBones[0])?.getWorldPosition(piv);
    root.worldToLocal(piv).multiply(root.scale);
    out.userData.turrets = [{ start: hullTris * 3, count: (tris - hullTris) * 3, pivot: [piv.x, piv.y, piv.z], yaw: 0 } satisfies TurretRange];
  }
  out.computeBoundingBox();
  return out;
}
