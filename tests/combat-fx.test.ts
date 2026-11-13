import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { UNITS, type UnitTypeId } from '../src/data/balance';
import { angleDelta, impactShake, lerpAngle, pathFacing, weaponOf } from '../src/render/combat';

describe('Kampfeffekte / combat effects', () => {
  it('jede Einheit hat eine Waffenart / every unit has a weapon kind', () => {
    for (const id of Object.keys(UNITS) as UnitTypeId[]) expect(typeof weaponOf(id)).toBe('string');
    expect(weaponOf('tank')).toBe('cannon');
    expect(weaponOf('tripod')).toBe('deathRay');
  });

  it('grosse Explosionen wackeln staerker als Gewehre / big explosions shake more than rifles', () => {
    expect(impactShake('rifle')).toBe(0);
    expect(impactShake('artillery')).toBeGreaterThan(impactShake('naval'));
    expect(impactShake('cannon')).toBeGreaterThan(0);
  });

  it('Drehung nimmt den kuerzesten Weg / turning takes the shortest way', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(Math.abs(angleDelta(3.0, -3.0))).toBeLessThan(0.3);
    expect(lerpAngle(3.0, -3.0, 1)).toBeCloseTo(2 * Math.PI - 3.0);
  });

  it('Blickrichtung folgt dem Pfad und endet in Laufrichtung / facing follows the path and ends in walking direction', () => {
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(1, 0, 1)];
    const face = pathFacing(pts, 0);
    expect(face(0)).toBeCloseTo(0);
    expect(face(0.9)).toBeCloseTo(Math.PI / 2);
    expect(face(2)).toBeCloseTo(0);
    expect(pathFacing([new THREE.Vector3()], 1.2)(0)).toBeCloseTo(1.2);
  });
});
