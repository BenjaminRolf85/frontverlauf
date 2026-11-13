/**
 * Lebendige Einheiten: Einordnung, Schadensstufen, Partikel-Obergrenzen.
 * Living units: classification, damage levels, particle caps.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { UNITS, type UnitTypeId } from '../src/data/balance';
import { FLAME_CAP, PUFF_CAP, UnitLife, damageLevel, lifeKind } from '../src/render/life';
import { addUnit, blankGame } from './helpers';

const fakeModel = () => {
  const model = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4).translate(0, 0.2, 0));
  model.add(mesh);
  model.userData.mesh = mesh;
  model.scale.setScalar(1.25);
  const group = new THREE.Group();
  group.add(model);
  return { group, model };
};

describe('Lebendige Einheiten / living units', () => {
  it('ordnet jede Einheit einer Gangart zu / classifies every unit into a gait', () => {
    expect(lifeKind('infantry')).toBe('foot');
    expect(lifeKind('android')).toBe('foot');
    expect(lifeKind('grey')).toBe('foot');
    expect(lifeKind('tank')).toBe('vehicle');
    expect(lifeKind('doomBuggy')).toBe('vehicle');
    expect(lifeKind('heli')).toBe('flyer');
    expect(lifeKind('skimmer')).toBe('flyer');
    expect(lifeKind('quadDrone')).toBe('flyer');
    expect(lifeKind('mech')).toBe('walker');
    expect(lifeKind('titan')).toBe('walker');
    expect(lifeKind('destroyer')).toBe('ship');
    for (const t of Object.keys(UNITS) as UnitTypeId[]) expect(['foot', 'vehicle', 'walker', 'flyer', 'ship']).toContain(lifeKind(t));
  });

  it('Schadensstufen bei 50 und 25 Prozent / damage levels at 50 and 25 percent', () => {
    expect(damageLevel(10, 10)).toBe(0);
    expect(damageLevel(5, 10)).toBe(0);
    expect(damageLevel(4, 10)).toBe(1);
    expect(damageLevel(3, 10)).toBe(1);
    expect(damageLevel(2, 10)).toBe(2);
    expect(damageLevel(0, 10)).toBe(0);
    expect(damageLevel(3, 0)).toBe(0);
  });

  it('Partikel bleiben begrenzt und verschwinden mit der Einheit / particles stay capped and vanish with the unit', () => {
    const s = blankGame({ stars: 0 });
    const life = new UnitLife();
    const seen = new Set<number>();
    const views: { group: THREE.Group; model: THREE.Group }[] = [];
    for (let i = 0; i < 40; i++) {
      const u = addUnit(s, i % 2 ? 'tank' : 'mech', 0, i % 10, Math.floor(i / 10));
      u.hp = 1;
      const v = fakeModel();
      v.group.position.set(i % 10, 0, Math.floor(i / 10));
      life.track(u, v.group, v.model, 0.035, 1.25, false);
      seen.add(u.id);
      views.push(v);
    }
    life.endSync(seen);
    for (let f = 0; f <= 600; f++) life.update(f * 16, true);
    expect(life.particleCount).toBeGreaterThan(0);
    expect(life.particleCount).toBeLessThanOrEqual(PUFF_CAP + FLAME_CAP);
    // Ruhehaltung nur leicht verlassen, Blickrichtung unberuehrt / rest pose left only slightly, facing untouched
    for (const v of views) {
      expect(Math.abs(v.model.rotation.x)).toBeLessThan(0.2);
      expect(Math.abs(v.model.rotation.z)).toBeLessThan(0.2);
      expect(v.model.rotation.y).toBe(0);
    }
    // alle weg: Flammen sofort aus, Rauch verweht / all gone: flames out at once, smoke drifts away
    life.endSync(new Set());
    for (let f = 601; f <= 900; f++) life.update(f * 16, true);
    expect(life.particleCount).toBe(0);
    for (const v of views) { expect(v.model.rotation.x).toBe(0); expect(v.model.scale.y).toBe(1.25); }
  });

  it('ohne Animationen nur einmal statisch zeichnen / without animations draw statically once', () => {
    const s = blankGame({ stars: 0 });
    const life = new UnitLife();
    const u = addUnit(s, 'tank', 0, 2, 2);
    u.hp = 1;
    const v = fakeModel();
    life.track(u, v.group, v.model, 0.035, 1.25, false);
    life.endSync(new Set([u.id]));
    expect(life.update(0, false)).toBe(true);
    expect(life.particleCount).toBeGreaterThan(0);
    expect(life.update(16, false)).toBe(false);
    expect(v.model.position.y).toBe(0.035);
  });
});
