/**
 * Hoehlen-Optik (m9): Modelle bauen, Leuchtmasken greifen, Verdan-Auge leuchtet nur wach, Wolken in Hoehlentoenen,
 * Hoehlentiere und Wasserfarben nur im Hoehlenthema.
 * Cavern visuals (m9): models build, glow masks apply, the Verdan eye glows only when awake, clouds in cave tones,
 * cavern creatures and water colours only in the cavern theme.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as models from '../src/render/models';
import {
  alienBones, caveFloorDeco, caveRockLump, crawlerGeometry, craterCracks, craterDebris, giantSkull, lizardGeometry, mothBodyGeometry, mothWingGeometry,
  mushroomForest, rockPillars, sporeDrifterGeometry, stalactite, supplyLineGeometry, verdanRemains, verdanRuinGeometry, verdanTurretGeometry,
} from '../src/render/models/cavern';
import { withGlow } from '../src/render/atmosphere';
import { CaveLife } from '../src/render/life';
import { setWaterTheme, waterMaterial } from '../src/render/water';
import { hex, semantic } from '../src/design/tokens';

/** Anteil leuchtender Ecken / share of glowing vertices */
const glowShare = (g: THREE.BufferGeometry) => {
  const a = withGlow(g.clone(), 'built').getAttribute('glow');
  let n = 0;
  for (let i = 0; i < a.count; i++) if (a.getX(i) > 0) n++;
  return n / a.count;
};

describe('Hoehlen-Modelle / cavern models', () => {
  it('alle Modelle bauen und sind nicht leer / all models build and are not empty', () => {
    const list: (THREE.BufferGeometry | null)[] = [
      ...[0, 1, 2, 3].map((v) => mushroomForest(v)), ...[0, 1, 2, 4].map((v) => caveFloorDeco(v)),
      rockPillars(0, false), rockPillars(1, true), caveRockLump(0), caveRockLump(2), stalactite(1),
      craterCracks(0, 0), craterCracks(2, 1), craterDebris(2), verdanRemains(1), alienBones(2), giantSkull(1),
      supplyLineGeometry('velkar', true), supplyLineGeometry(null, false), verdanTurretGeometry(false), verdanTurretGeometry(true), verdanRuinGeometry(),
      crawlerGeometry(), sporeDrifterGeometry(), lizardGeometry(), mothBodyGeometry(), mothWingGeometry(),
    ];
    for (const g of list) {
      expect(g).not.toBeNull();
      expect(g!.getAttribute('position').count).toBeGreaterThan(30);
      expect(g!.getAttribute('color')).toBeTruthy();
    }
    // manche Bodenfelder bleiben leer / some floor tiles stay empty
    expect(caveFloorDeco(3)).toBeNull();
  });

  it('Pilze, Risse und Laternen leuchten / mushrooms, cracks and lanterns glow', () => {
    expect(glowShare(mushroomForest(0))).toBeGreaterThan(0.1);
    expect(glowShare(craterCracks(0, 0))).toBeGreaterThan(0.1);
    expect(glowShare(supplyLineGeometry('alvenia', false))).toBeGreaterThan(0);
    expect(glowShare(rockPillars(0, false))).toBeGreaterThan(0);
  });

  it('Verdan-Auge leuchtet nur im wachen Zustand / the Verdan eye glows only when awake', () => {
    expect(glowShare(verdanTurretGeometry(true))).toBeGreaterThan(glowShare(verdanTurretGeometry(false)));
    expect(glowShare(verdanTurretGeometry(false))).toBe(0);
  });

  it('Nebelwolken der Hoehle nur in Hoehlentoenen / cave fog clouds only in cave tones', () => {
    const g = models.caveCloudGeometry(1);
    const c = g.getAttribute('color');
    const allowed = [semantic.caveFog, semantic.caveFogShade].map((h) => new THREE.Color(hex(h)));
    for (let i = 0; i < c.count; i += 7) {
      expect(allowed.some((a) => Math.abs(a.r - c.getX(i)) + Math.abs(a.g - c.getY(i)) + Math.abs(a.b - c.getZ(i)) < 0.01)).toBe(true);
    }
    // normale Wolke unveraendert / normal cloud unchanged
    expect(models.cloudGeometry(1)).not.toBe(g);
  });
});

describe('Hoehlen-Leben und Wasser / cavern life and water', () => {
  it('Hoehlentiere: Instanzen je Art, Motten mit zwei Fluegeln / creatures: instances per kind, moths with two wings', () => {
    const life = new CaveLife();
    life.build([
      { kind: 'crawler', x: 0, y: 0, z: 0, phase: 0.1 }, { kind: 'crawler', x: 1, y: 0, z: 1, phase: 0.4 },
      { kind: 'moth', x: 2, y: 0, z: 2, phase: 0.2 }, { kind: 'drifter', x: 3, y: 0, z: 0, phase: 0.7 }, { kind: 'lizard', x: 0, y: 0, z: 3, phase: 0.9 },
    ]);
    expect(life.active).toBe(true);
    const meshes = life.group.children as THREE.InstancedMesh[];
    expect(meshes.reduce((n, m) => n + m.count, 0)).toBe(2 * 2 + 2 + 2 + 2 + 2);
    life.update(3.5);
    life.clear();
    expect(life.active).toBe(false);
    expect(life.group.children.length).toBe(0);
  });

  it('Wasser: Hoehlenfarben an und wieder aus / water: cave colours on and off again', () => {
    const m = waterMaterial();
    const before = (m.uniforms.uShallow.value as THREE.Color).getHex();
    setWaterTheme(true);
    expect(m.uniforms.uCaveGlow.value).toBe(1);
    expect((m.uniforms.uShallow.value as THREE.Color).getHex()).not.toBe(before);
    setWaterTheme(false);
    expect(m.uniforms.uCaveGlow.value).toBe(0);
    expect((m.uniforms.uShallow.value as THREE.Color).getHex()).toBe(before);
  });
});
