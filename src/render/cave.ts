/**
 * Hoehlenhuelle fuer das Kampagnenfinale: dunkler Hintergrund, Hoehlenboden um die Karte, Felswaende im Aussenring,
 * ein Gewoelbe aus Felsboegen mit Tropfsteinen. Die Seiten, die zur Kamera zeigen, bleiben niedrig, damit die
 * Spielflaeche aus jeder der vier Kamerastellungen frei sichtbar ist (siehe setView); hohe Waende und das Gewoelbe
 * stehen nur auf den abgewandten Seiten. Alles instanziert, bei niedriger Qualitaet duenner.
 * Cave shell for the campaign finale: dark background, cave floor around the map, rock walls in the outer ring,
 * a vault of rock arches with stalactites. Sides facing the camera stay low so the play area is clearly visible from
 * each of the four camera presets (see setView); tall walls and the vault stand only on the far sides.
 * Everything instanced, thinner on low quality.
 */
import * as THREE from 'three';
import { semantic } from '../design/tokens';
import { OUTLINE } from './config';
import { landMaterial, withGlow } from './atmosphere';
import { caveRockLump, stalactite } from './models/cavern';
import { outlinedInstanced, paint } from './toon';
import { rng } from './models/kit';

/** Hoehe der Kamera-zugewandten Felsen bleibt unter Abstand / 1.5 (verdeckt nichts) / near rocks stay below offset / 1.5 */
const NEAR_HEIGHT = 0.55;

let bg: THREE.CanvasTexture | null = null;
/** Senkrechter Verlauf fuer den Szenenhintergrund / vertical gradient for the scene background */
export function caveBackground(): THREE.Texture {
  if (bg) return bg;
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, semantic.caveBackgroundBottom);
  g.addColorStop(0.45, semantic.caveBackgroundTop);
  g.addColorStop(1, semantic.caveBackgroundBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  bg = new THREE.CanvasTexture(c);
  bg.colorSpace = THREE.SRGBColorSpace;
  return bg;
}

interface Side { normal: THREE.Vector2; low: THREE.Object3D[]; tall: THREE.Object3D[] }

export class CaveShell {
  readonly group = new THREE.Group();
  private sides: Side[] = [];
  private key = '';
  private angle = Math.PI / 4;

  /** Aufbauen (nur bei neuer Groesse, neuem Seed oder Qualitaet) / build (only on new size, seed or quality) */
  build(size: number, seed: number, low: boolean) {
    const key = `${size}-${seed}-${low}`;
    if (key === this.key) return;
    this.clear();
    this.key = key;
    const half = size / 2;
    const R = rng(seed ^ 0x51a7);
    // Hoehlenboden um die Karte / cave floor around the map
    const floor = new THREE.Mesh(withGlow(paint(new THREE.BoxGeometry(size + 14, 0.2, size + 14).toNonIndexed(), semantic.caveWallDark), 'none'), landMaterial());
    floor.position.y = -0.52;
    floor.receiveShadow = true;
    floor.raycast = () => {};
    this.group.add(floor);
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const step = low ? 1.6 : 1.15;
    const layers = low ? 3 : 4;
    for (const [nx, nz] of dirs) {
      const lowM: THREE.Matrix4[][] = [[], [], []];
      const tallM: THREE.Matrix4[][] = [[], [], []];
      const drops: THREE.Matrix4[][] = [[], [], []];
      const along = (t: number, out: number, y: number) => new THREE.Vector3(nx * (half + out) + (nz !== 0 ? t : 0), y, nz * (half + out) + (nx !== 0 ? t : 0));
      const M = (p: THREE.Vector3, s: THREE.Vector3, ry: number) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 0.4, ry, R() * 0.4)), s);
      for (let t = -half - 4; t <= half + 4; t += step) {
        const jt = t + (R() - 0.5) * step * 0.6;
        // niedrige Felsen am Rand (immer sichtbar) / low rocks at the edge (always visible)
        const o = 1.3 + R() * 0.8;
        const s = 0.7 + R() * 0.6;
        lowM[Math.floor(R() * 3)].push(M(along(jt, o, -0.42 + NEAR_HEIGHT * 0.3), new THREE.Vector3(s * 1.4, Math.min(NEAR_HEIGHT * 1.3, s), s * 1.2), R() * 6));
        // hohe Wand aus gestapelten Brocken, nach innen ueberhaengend (Gewoelbe) / tall wall of stacked lumps, overhanging inwards (vault)
        let y = 0.1;
        for (let k = 0; k < layers; k++) {
          const ss = 1.5 + R() * 1.1 - k * 0.08;
          const out = 2.6 + R() * 1.2 - k * k * 0.12;
          tallM[Math.floor(R() * 3)].push(M(along(jt + (R() - 0.5) * 0.5, out, y), new THREE.Vector3(ss * 1.2, ss, ss), R() * 6));
          y += ss * 0.75;
        }
        // Gewoelbebogen: Brocken ueber dem Rand / vault arch: lumps above the edge
        const archY = y + 0.2;
        tallM[Math.floor(R() * 3)].push(M(along(jt, 0.6 + R() * 0.6, archY), new THREE.Vector3(1.8, 1.0 + R() * 0.5, 1.6), R() * 6));
        // Vorhang aus Tropfsteinen ueber dem Aussenring (vor der Wand, ausserhalb der Karte) / curtain of stalactites above the outer ring
        if (R() < (low ? 0.35 : 0.7)) {
          const len = 1.1 + R() * 2.2;
          drops[Math.floor(R() * 3)].push(new THREE.Matrix4().compose(along(jt + (R() - 0.5) * 0.4, 0.8 + R() * 1.2, archY + 0.4),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(1.5 + R() * 0.8, len, 1.5 + R() * 0.8)));
        }
        // Tropfsteine unter dem Gewoelbe; ragen hoechstens h - 0.5 ueber die Karte / stalactites under the vault
        if (R() < (low ? 0.5 : 0.85)) {
          const len = 0.9 + R() * 1.8;
          const inward = Math.min(len * 0.4, (archY - len) - 0.6);
          drops[Math.floor(R() * 3)].push(new THREE.Matrix4().compose(along(jt + (R() - 0.5) * 0.6, Math.max(-0.4, -inward), archY - 0.2),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0, R() * 6, 0)), new THREE.Vector3(1 + R() * 0.6, len, 1 + R() * 0.6)));
        }
      }
      const side: Side = { normal: new THREE.Vector2(nx, nz), low: [], tall: [] };
      const put = (list: THREE.Matrix4[][], geo: (v: number) => THREE.BufferGeometry, target: THREE.Object3D[]) => list.forEach((mats, v) => {
        if (!mats.length) return;
        const { mesh, line } = outlinedInstanced(withGlow(geo(v), 'nature'), mats.length, OUTLINE.tile * 2, landMaterial());
        mats.forEach((m, i) => { mesh.setMatrixAt(i, m); line.setMatrixAt(i, m); });
        mesh.instanceMatrix.needsUpdate = true; line.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere(); line.computeBoundingSphere();
        for (const o of [mesh, line]) { o.raycast = () => {}; this.group.add(o); target.push(o); }
      });
      put(lowM, caveRockLump, side.low);
      put(tallM, caveRockLump, side.tall);
      put(drops, stalactite, side.tall);
      this.sides.push(side);
    }
    this.setView(this.angle);
  }

  /**
   * Hohe Waende nur auf den von der Kamera abgewandten Seiten / tall walls only on the sides facing away from the camera.
   * angle = Kamerawinkel um die y-Achse (View.angle) / camera angle around the y axis.
   */
  setView(angle: number) {
    this.angle = angle;
    const cam = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    for (const s of this.sides) {
      const far = s.normal.dot(cam) < -0.2;
      for (const o of s.tall) o.visible = far;
    }
  }

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
      else (c as THREE.Mesh).geometry?.dispose();
    }
    this.sides = [];
    this.key = '';
  }
}
