/**
 * Leben in Staedten und Glut auf der Karte: Lichtkegel am Boden (Stadtlicht in der Daemmerung und Nacht, Lava-Schein),
 * blinkendes Leuchtfeuer am Hauptquartier und Schornsteinrauch, der langsam aufsteigt (mehr Rauch mit der Stadtstufe).
 * Dazu die Rotoren der Windraeder besetzter Stuetzpunkte: eine instanzierte Geometrie fuer die ganze Karte.
 * Life in cities and glow on the map: light pools on the ground (city light at dusk and night, lava glow),
 * a blinking beacon on the HQ and chimney smoke that rises slowly (more smoke with the city level).
 * Plus the rotors of the wind turbines of owned bases: one instanced geometry for the whole map.
 */
import * as THREE from 'three';
import type { FactionId } from '../data/balance';
import { factionTokens, hex, semantic } from '../design/tokens';
import { ATMO, landMaterial, withGlow } from './atmosphere';
import { OUTLINE } from './config';
import { rotorGeometry } from './models/bases';
import { flatToon, outlinedInstanced } from './toon';
import { glowColor } from './post';

export interface TownInput {
  /** beacon: Spitze des HQ-Masts relativ zur Feldmitte (fehlt = alte feste Stelle) / beacon: top of the HQ mast relative to the tile centre (missing = the old fixed spot) */
  /**
   * smoke: Rauchquellen relativ zur Feldmitte statt der hoechsten Punkte der Zellen (Stuetzpunkte: nur die Schlote);
   * dark: kein Lichtkegel (verlassener Stuetzpunkt).
   * smoke: smoke sources relative to the tile centre instead of the highest cell points (bases: the stacks only);
   * dark: no light pool (abandoned base).
   * rotors: drehende Rotoren relativ zur Feldmitte (BaseMeta.rotors) / spinning rotors relative to the tile centre (BaseMeta.rotors).
   * beaconKey: Schluessel, unter dem das Brett das Leuchtfeuer verschieben kann (schwebende Akademie) / key under which the
   * board can move the beacon (floating academy).
   */
  cities: { x: number; z: number; y: number; level: number; faction: FactionId | null; hq: boolean; govQuarter: boolean; geo: THREE.BufferGeometry; beacon?: [number, number, number]; beaconKey?: number; smoke?: [number, number, number][]; dark?: boolean; rotors?: [number, number, number, number, number, number][] }[];
  /**
   * Tiefenmaske fuer die Rotoren (hohe Qualitaet): Material und Zeichenreihenfolge wie bei den Stadtmasken (CITY_MASK).
   * Depth mask for the rotors (high quality): material and render order as for the city masks (CITY_MASK).
   */
  rotorMask?: { material: THREE.Material; order: number };
  /** Lava und Vulkane / lava and volcanoes */
  lava: { x: number; z: number; y: number; size: number }[];
  /** Hoehle: farbige Lichtflecken (Pilze, Teiche, Krater, Laternen, Verdan-Auge) / cavern: coloured light pools */
  glow?: { x: number; z: number; y: number; size: number; color: THREE.Color }[];
}

// ---------- Lichtkegel / light pools ----------

/** Nur Farbe addieren, Alpha nie aendern (transparenter Canvas bleibt durchsichtig) / add colour only, never alpha (transparent canvas stays clear) */
export const ADD_RGB = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
} as const;

function poolMaterial(mix: { value: number }, base: number, gain: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uMix: mix, uBase: { value: base }, uGain: { value: gain } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        vCol = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #endif
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uMix;
      uniform float uBase;
      uniform float uGain;
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        // drei harte Ringe statt weichem Verlauf (Comic) / three hard rings instead of a soft falloff (comic)
        float a = 1.0 - smoothstep(0.0, 1.0, d);
        a = floor(a * a * 3.0 + 0.6) / 3.0;
        gl_FragColor = vec4(vCol * a * (uBase + uGain * uMix), 0.0);
        #include <colorspace_fragment>
      }`,
    // nicht 'transparent': so laeuft es im deckenden Durchgang vor dem Tiefen-Loeschen fuer Einheiten
    // not 'transparent': this way it runs in the opaque pass before the depth clear for units
    ...ADD_RGB,
    depthWrite: false,
  });
}

let radial: THREE.DataTexture | null = null;
/** Weicher runder Lichtfleck fuer Sprites / soft round light spot for sprites */
export function radialTexture(): THREE.DataTexture {
  if (radial) return radial;
  const n = 32, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.min(1, Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2));
    const a = Math.pow(1 - d, 2);
    data.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4);
  }
  radial = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  radial.needsUpdate = true;
  return radial;
}

// ---------- Schornsteine / chimneys ----------

const CELL = 0.255;
const emitterCache = new WeakMap<THREE.BufferGeometry, { x: number; y: number; z: number; cell: string }[]>();
/** Hoechste Punkte je Zelle des 3x3-Stadtrasters / highest points per cell of the 3x3 city grid */
function cellTops(g: THREE.BufferGeometry) {
  let list = emitterCache.get(g);
  if (list) return list;
  const pos = g.getAttribute('position');
  const best = new Map<string, { x: number; y: number; z: number; cell: string }>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const cx = Math.max(-1, Math.min(1, Math.round(x / CELL))), cz = Math.max(-1, Math.min(1, Math.round(z / CELL)));
    const cell = `${cx},${cz}`;
    const b = best.get(cell);
    if (!b || y > b.y) best.set(cell, { x, y, z, cell });
  }
  list = [...best.values()].sort((a, b) => b.y - a.y);
  emitterCache.set(g, list);
  return list;
}

interface Emitter { x: number; y: number; z: number; phase: number }
const PUFFS = 4;
const PUFF_PERIOD = 4.2;
/** Drehzahl der Rotoren in rad/s; je Windrad um bis zu spread verschieden / rotor speed in rad/s; differs per turbine by up to spread */
const ROTOR_SPIN = { speed: 1.5, spread: 0.25 };
interface Rotor { x: number; y: number; z: number; yaw: number; phase: number; scale: number; rate: number }

export class TownFx {
  readonly group = new THREE.Group();
  private smoke: { mesh: THREE.InstancedMesh; line: THREE.InstancedMesh } | null = null;
  private emitters: Emitter[] = [];
  private beacons: { core: THREE.Mesh; halo: THREE.Sprite; phase: number }[] = [];
  /** verschiebbare Leuchtfeuer (Akademie): Grundlage der Lage / movable beacons (academy): base position */
  private movable = new Map<number, { core: THREE.Mesh; halo: THREE.Sprite; base: THREE.Vector3 }>();
  private rotors: Rotor[] = [];
  private rotorMeshes: THREE.InstancedMesh[] = [];
  /**
   * Tiefenmaske der Rotoren (fehlt ohne Rotoren oder bei niedriger Qualitaet); das Brett schiebt sie wie die Stadtmasken
   * entlang der Blickachse nach hinten.
   * Depth mask of the rotors (absent without rotors or on low quality); the board pushes it back along the view axis
   * like the city masks.
   */
  rotorMask: THREE.InstancedMesh | null = null;
  private tmp = new THREE.Object3D();
  private poolMats = {
    city: poolMaterial(ATMO.uWindow, 0, 0.55),
    lava: poolMaterial(ATMO.uNight, 0.22, 0.6),
    cave: poolMaterial(ATMO.uGlow, 0.04, 0.2),
  };
  private smokeMat = flatToon(semantic.chimneySmoke);
  private beaconMat = new THREE.MeshBasicMaterial({ color: glowColor(hex(semantic.beacon), 3) });
  private haloMat = new THREE.SpriteMaterial({ map: radialTexture(), color: hex(semantic.beacon), ...ADD_RGB, blendSrc: THREE.SrcAlphaFactor, depthWrite: false, transparent: false });
  private pools: { mesh: THREE.InstancedMesh; mix: { value: number }; base: number }[] = [];
  // Geometrien einmal bauen und wiederverwenden (sonst waechst der GPU-Speicher mit jedem Neuaufbau)
  // geometries built once and reused (otherwise GPU memory grows with every rebuild)
  private plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private beaconGeo = new THREE.SphereGeometry(0.026, 8, 6);
  private puffGeo = new THREE.IcosahedronGeometry(0.05, 0);

  build(inp: TownInput) {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
    }
    // je Leuchtfeuer geklontes Halo-Material freigeben / dispose the halo material cloned per beacon
    for (const b of this.beacons) b.halo.material.dispose();
    this.beacons = [];
    this.movable.clear();
    this.emitters = [];
    this.pools = [];
    this.rotors = [];
    this.rotorMeshes = [];
    this.rotorMask = null;
    const plane = this.plane;
    // Stadtlicht: warm, bei NEXUS cyan, bei Zyrr violett / city light: warm, cyan for NEXUS, violet for Zyrr
    const warm = new THREE.Color(hex(semantic.cityWindow));
    const tint = (f: FactionId | null) => f === 'nexus' ? new THREE.Color(hex(factionTokens.nexus.marker)) : f === 'zyrr' ? new THREE.Color(hex(semantic.xenoGlow)) : warm;
    const pools = (list: { x: number; y: number; z: number; s: number; c: THREE.Color }[], mat: THREE.ShaderMaterial) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(plane, mat, list.length);
      list.forEach((p, i) => {
        this.tmp.position.set(p.x, p.y, p.z); this.tmp.rotation.set(0, 0, 0); this.tmp.scale.set(p.s, 1, p.s); this.tmp.updateMatrix();
        m.setMatrixAt(i, this.tmp.matrix);
        m.setColorAt(i, p.c);
      });
      m.raycast = () => {};
      m.renderOrder = 3;
      m.frustumCulled = false;
      this.group.add(m);
      this.pools.push({ mesh: m, mix: mat.uniforms.uMix, base: mat.uniforms.uBase.value });
    };
    pools(inp.cities.filter((c) => !c.dark).map((c) => ({ x: c.x, y: c.y + 0.015, z: c.z, s: 1.2 + Math.min(8, c.level) * 0.08, c: tint(c.faction) })), this.poolMats.city);
    const lavaC = new THREE.Color(hex(semantic.lavaLight));
    pools(inp.lava.map((l) => ({ x: l.x, y: l.y + 0.02, z: l.z, s: l.size, c: lavaC })), this.poolMats.lava);
    pools((inp.glow ?? []).map((l) => ({ x: l.x, y: l.y + 0.018, z: l.z, s: l.size, c: l.color })), this.poolMats.cave);

    // Leuchtfeuer am HQ-Mast / beacon on the HQ mast
    for (const c of inp.cities) {
      if (c.hq) {
        const h = 0.5 + Math.min(c.level, 6) * 0.03 + 0.06;
        const core = new THREE.Mesh(this.beaconGeo, this.beaconMat);
        const [bx, by, bz] = c.beacon ?? [-0.335, h, 0.325];
        core.position.set(c.x + bx, c.y + by, c.z + bz);
        const halo = new THREE.Sprite(this.haloMat.clone());
        halo.position.copy(core.position);
        halo.scale.setScalar(0.32);
        for (const o of [core, halo]) { o.raycast = () => {}; o.renderOrder = 6; this.group.add(o); }
        this.beacons.push({ core, halo, phase: (c.x * 3.1 + c.z * 1.7) % 6 });
        if (c.beaconKey !== undefined) this.movable.set(c.beaconKey, { core, halo, base: core.position.clone() });
      }
      // Schornsteine: hoechste Punkte der Zellen, ohne Mast und Regierungskuppel / chimneys: highest cell points, no mast or gov dome
      if (c.smoke) {
        c.smoke.slice(0, 4).forEach(([sx, sy, sz], i) => {
          this.emitters.push({ x: c.x + sx, y: c.y + sy + 0.02, z: c.z + sz, phase: (c.x * 0.37 + c.z * 0.61 + i * 0.29) % 1 });
        });
        continue;
      }
      const skip = new Set<string>();
      if (c.hq) skip.add('-1,1');
      if (c.govQuarter) skip.add('1,-1');
      const count = c.faction === null ? 1 : Math.min(4, 1 + Math.floor(c.level / 2));
      cellTops(c.geo).filter((e) => !skip.has(e.cell) && e.y > 0.06).slice(0, count).forEach((e, i) => {
        this.emitters.push({ x: c.x + e.x, y: c.y + e.y + 0.02, z: c.z + e.z, phase: (c.x * 0.37 + c.z * 0.61 + i * 0.29) % 1 });
      });
    }
    // Rotoren: Netz, Tuschelinie und (hohe Qualitaet) Tiefenmaske, je einmal fuer die ganze Karte
    // rotors: mesh, ink line and (high quality) depth mask, once each for the whole map
    for (const c of inp.cities) for (const [rx, ry, rz, yaw, phase, scale] of c.rotors ?? []) {
      this.rotors.push({ x: c.x + rx, y: c.y + ry, z: c.z + rz, yaw, phase, scale, rate: 1 + ROTOR_SPIN.spread * Math.sin(phase * 7 + c.x * 1.3 + c.z * 2.1) });
    }
    if (this.rotors.length) {
      const g = withGlow(rotorGeometry(), 'none');
      const { mesh, line } = outlinedInstanced(g, this.rotors.length, OUTLINE.building, landMaterial());
      this.rotorMeshes = [mesh, line];
      if (inp.rotorMask) {
        this.rotorMask = new THREE.InstancedMesh(g, inp.rotorMask.material, this.rotors.length);
        this.rotorMask.renderOrder = inp.rotorMask.order;
        this.rotorMeshes.push(this.rotorMask);
      }
      for (const m of this.rotorMeshes) { m.raycast = () => {}; m.frustumCulled = false; this.group.add(m); }
    }
    if (this.emitters.length) {
      this.smoke = outlinedInstanced(this.puffGeo, this.emitters.length * PUFFS, 0.012, this.smokeMat);
      for (const m of [this.smoke.mesh, this.smoke.line]) { m.raycast = () => {}; m.frustumCulled = false; this.group.add(m); }
    } else this.smoke = null;
    this.update(0);
  }

  /**
   * Leuchtfeuer key um (dx, dy, dz) gegen seine gebaute Lage verschieben (folgt dem Auf und Ab und den Uebergaengen der
   * Akademie). Move beacon key by (dx, dy, dz) from its built position (follows the academy's bob and transitions).
   */
  shiftBeacon(key: number, dx: number, dy: number, dz: number) {
    const b = this.movable.get(key);
    if (!b) return;
    b.core.position.set(b.base.x + dx, b.base.y + dy, b.base.z + dz);
    b.halo.position.copy(b.core.position);
  }

  /** time in Sekunden (steht ohne Animationen) / time in seconds (frozen without animations) */
  update(time: number) {
    const o = this.tmp;
    if (this.smoke) {
      const { mesh, line } = this.smoke;
      let i = 0;
      for (const e of this.emitters) {
        for (let k = 0; k < PUFFS; k++) {
          const t = (time / PUFF_PERIOD + e.phase + k / PUFFS) % 1;
          // aufsteigen, mit dem Wind treiben, wachsen und vergehen / rise, drift with the wind, grow and fade
          const grow = Math.min(1, t / 0.15) * (t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1);
          o.position.set(e.x + t * 0.16 + Math.sin(t * 6 + e.phase * 9) * 0.015, e.y + t * 0.42, e.z - t * 0.06);
          o.rotation.set(t * 1.3, e.phase * 6 + t, 0);
          o.scale.setScalar(Math.max(0.001, (0.45 + t * 1.25) * grow));
          o.updateMatrix();
          mesh.setMatrixAt(i, o.matrix); line.setMatrixAt(i, o.matrix);
          i++;
        }
      }
      mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
    }
    if (this.rotors.length) {
      this.rotors.forEach((r, i) => {
        o.position.set(r.x, r.y, r.z);
        // erst um die Rotorachse (z), dann zur Blickrichtung des Windrads (y) / first about the rotor axis (z), then to the turbine's heading (y)
        o.rotation.set(0, r.yaw, r.phase + time * ROTOR_SPIN.speed * r.rate);
        o.scale.setScalar(r.scale);
        o.updateMatrix();
        for (const m of this.rotorMeshes) m.setMatrixAt(i, o.matrix);
      });
      for (const m of this.rotorMeshes) m.instanceMatrix.needsUpdate = true;
    }
    // Lichtkegel ohne Wirkung gar nicht zeichnen (spart Fuellrate am Tag) / skip pools without effect (saves fill rate by day)
    for (const p of this.pools) p.mesh.visible = p.base + p.mix.value > 0.02;
    const w = ATMO.uWindow.value;
    for (const b of this.beacons) {
      // kurzes Blinken alle 1,6 s / short blink every 1.6 s
      const blink = ((time + b.phase) % 1.6) < 0.8 ? 1 : 0.35;
      const on = w > 0.05;
      b.core.visible = b.halo.visible = on;
      b.halo.material.opacity = Math.min(1, w) * blink;
      b.core.scale.setScalar(0.7 + 0.3 * blink);
    }
  }
}
