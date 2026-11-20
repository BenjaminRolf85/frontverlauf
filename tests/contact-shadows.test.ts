/**
 * Bodenschatten und Lichtbalance: Standflaechen aus der Geometrie (Baum ja, flache Marke, Gebaeude und Rauch nein),
 * immer gleich (ohne Zufall), Wald-Deko bekommt Flecken; Schattentreppe und Lichtsumme je Stimmung.
 * Contact shadows and light balance: footprints from the geometry (tree yes; flat decal, building and smoke no),
 * always the same (no randomness), forest decoration gets blobs; shading ramp and light sum per mood.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONTACT, ContactShadows, footprints } from '../src/render/contact';
import { decorationGeometry } from '../src/render/models';
import { TOON_RAMP } from '../src/render/toon';
import { ATMO, CLOUD_LOOK, cloudMaterial, SHADOW_EDGE } from '../src/render/atmosphere';
import { Sky } from '../src/render/sky';
import { hex } from '../src/design/tokens';

/** Baum aus Stamm und Krone an der Stelle (x, z) / tree made of trunk and crown at (x, z) */
const tree = (x: number, z: number) => mergeGeometries([
  new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6).toNonIndexed().translate(x, 0.05, z),
  new THREE.ConeGeometry(0.1, 0.3, 6).toNonIndexed().translate(x, 0.25, z),
])!;

describe('Bodenschatten / contact shadows', () => {
  it('Baum: ein Fleck unter der Krone / tree: one blob under the crown', () => {
    const f = footprints(tree(0.2, -0.1));
    expect(f).toHaveLength(1);
    expect(f[0].x).toBeCloseTo(0.2, 2);
    expect(f[0].z).toBeCloseTo(-0.1, 2);
    expect(f[0].r).toBeGreaterThan(0.08);
    expect(f[0].r).toBeLessThan(0.11);
  });

  it('zwei Baeume: zwei Flecken, bei jedem Aufruf gleich / two trees: two blobs, the same on every call', () => {
    const a = footprints(mergeGeometries([tree(-0.2, 0), tree(0.2, 0.1)])!);
    const b = footprints(mergeGeometries([tree(-0.2, 0), tree(0.2, 0.1)])!);
    expect(a).toHaveLength(2);
    expect(b).toEqual(a);
  });

  it('flache Marke, Gebaeude, Schwebendes und Rauch: kein Fleck / flat decal, building, floating part and smoke: no blob', () => {
    expect(footprints(new THREE.BoxGeometry(0.3, 0.01, 0.3).toNonIndexed())).toHaveLength(0);
    expect(footprints(new THREE.BoxGeometry(0.7, 0.4, 0.7).toNonIndexed().translate(0, 0.2, 0))).toHaveLength(0);
    expect(footprints(new THREE.SphereGeometry(0.1, 6, 4).toNonIndexed().translate(0, 0.5, 0))).toHaveLength(0);
    const smoke = tree(0, 0);
    smoke.name = 'volcanoSmoke';
    expect(footprints(smoke)).toHaveLength(0);
    // lang und schmal (Zaun) / long and thin (fence)
    expect(footprints(new THREE.BoxGeometry(0.4, 0.15, 0.03).toNonIndexed().translate(0, 0.075, 0))).toHaveLength(0);
  });

  it('Wald-Deko: Flecken innerhalb des Feldes, hoechstens cap / forest decoration: blobs inside the tile, at most cap', () => {
    for (let v = 0; v < 4; v++) {
      const g = decorationGeometry('forest', null, v)!;
      const f = footprints(g);
      expect(f.length).toBeGreaterThan(0);
      expect(f.length).toBeLessThanOrEqual(CONTACT.deco.cap);
      for (const p of f) expect(Math.max(Math.abs(p.x), Math.abs(p.z)) + p.r * CONTACT.deco.grow).toBeLessThan(0.75);
    }
  });

  it('ein Netz fuer die Deko, eines fuer die Einheiten; Deko auf Wasser ohne Fleck / one mesh for decoration, one for units; decoration on water without a blob', () => {
    const c = new ContactShadows();
    const g = tree(0, 0);
    c.buildDeco([[[g, [new THREE.Matrix4().makeTranslation(1, 0, 2), new THREE.Matrix4().makeTranslation(3, -0.09, 2)]]]]);
    expect(c.count).toBe(1);
    c.beginUnits(3);
    c.unit(0, new THREE.Vector3(0, 0, 0), 1);
    c.unit(1, new THREE.Vector3(1, 0.12, 0), 0.5);
    c.endUnits(2);
    expect(c.count).toBe(3);
    expect(c.group.children).toHaveLength(2);
    // nach den Feldern, vor den Lichtkegeln (3) / after the tiles, before the light pools (3)
    for (const m of c.group.children) expect(m.renderOrder).toBe(CONTACT.order);
    c.endUnits(0);
    expect(c.count).toBe(1);
  });
});

describe('Licht und Schatten / light and shadow', () => {
  it('Schattentreppen steigen an; die Wolken haben die sanftere / shading ramps ascend; the clouds have the gentler one', () => {
    for (const r of Object.values(TOON_RAMP)) { expect(r[0]).toBeLessThan(r[1]); expect(r[1]).toBeLessThan(r[2]); expect(r[2]).toBe(255); }
    expect(TOON_RAMP.soft[0]).toBeGreaterThan(TOON_RAMP.hard[0]);
    expect(SHADOW_EDGE.from).toBeLessThan(SHADOW_EDGE.to);
  });

  it('Nebelwolken: getoent, nie heller als Weiss / fog clouds: tinted, never brighter than white', () => {
    const m = cloudMaterial();
    const tint = new THREE.Color(hex(CLOUD_LOOK.tint));
    expect(m.color.r).toBeCloseTo(tint.r * CLOUD_LOOK.brightness, 5);
    expect(Math.max(m.color.r, m.color.g, m.color.b)).toBeLessThan(1);
  });

  it('Tageszeiten: Schatten am Tag am staerksten, nachts am schwaechsten; Summe des Lichts wie zuvor / times of day: shadows strongest by day, weakest at night; sum of the light as before', () => {
    const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
    const sky = new Sky(hemi, sun);
    // Summe aus Umgebungslicht und Sonne vor der Aenderung / sum of ambient light and sun before the change
    const sums = { day: 3.8, dusk: 3.45, night: 2.8, dawn: 3.45 };
    const seen: Record<string, { shadow: number; contact: number }> = {};
    for (const phase of ['dusk', 'night', 'dawn', 'day'] as const) {
      sky.set(phase, 0, false);
      expect(hemi.intensity + sun.intensity).toBeCloseTo(sums[phase], 5);
      expect(sun.intensity).toBeGreaterThanOrEqual(hemi.intensity * 0.9);
      seen[phase] = { shadow: ATMO.uShadow.value.x, contact: ATMO.uContact.value };
      expect(ATMO.uSunXZ.value.length()).toBeCloseTo(1, 5);
    }
    expect(seen.day.shadow).toBeGreaterThan(seen.dusk.shadow);
    expect(seen.dusk.shadow).toBeGreaterThan(seen.night.shadow);
    expect(seen.day.contact).toBeGreaterThan(seen.night.contact);
    expect(seen.night.contact).toBeGreaterThan(0);
  });
});
