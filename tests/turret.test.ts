/**
 * Drehtuerme: Builder teilt Turmteile ab (Bereich, Drehpunkt, Ruherichtung), splitTurrets zerlegt die Geometrie,
 * alle Panzer haben einen Turm, Zielwinkel und Muendung folgen dem Turm.
 * Turrets: the Builder separates turret parts (range, pivot, rest heading), splitTurrets splits the geometry,
 * every tank has a turret, aim angles and muzzle follow the turret.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Builder, splitTurrets, turretsOf } from '../src/render/models/kit';
import { unitGeometry } from '../src/render/models';
import { tank } from '../src/render/models/vehicles';
import { turretMuzzle, turretYaw } from '../src/render/combat';
import type { FactionId, UnitTypeId } from '../src/data/balance';

/** Ecken einer Quader-Geometrie (nicht indiziert) / vertices of a box geometry (non-indexed) */
const BOX = 36;

describe('Builder.turret', () => {
  it('ohne Turm bleibt alles wie bisher / without a turret nothing changes', () => {
    const b = new Builder();
    b.box(0.2, 0.1, 0.3, '#808080', [0, 0.05, 0]);
    const g = b.build();
    expect(turretsOf(g)).toEqual([]);
    expect(splitTurrets(g)).toBeNull();
    expect(g.getAttribute('position').count).toBe(BOX);
  });

  it('Turmteile liegen am Ende, Drehpunkt in Modellkoordinaten / turret parts come last, pivot in model coordinates', () => {
    const b = new Builder();
    b.box(0.3, 0.1, 0.4, '#808080', [0, 0.05, 0]);
    b.group({ p: [0, 0, -0.05] }, () => {
      b.turret([0, 0.1, 0], () => {
        b.box(0.15, 0.06, 0.15, '#606060', [0, 0.13, 0]);
        b.box(0.02, 0.02, 0.2, '#404040', [0, 0.13, 0.15]);
      });
    });
    b.box(0.05, 0.05, 0.05, '#202020', [0, 0.12, -0.18]);
    const g = b.build();
    expect(g.getAttribute('position').count).toBe(4 * BOX);
    const [t] = turretsOf(g);
    expect(turretsOf(g)).toHaveLength(1);
    expect(t.start).toBe(2 * BOX);
    expect(t.count).toBe(2 * BOX);
    expect(t.pivot[0]).toBeCloseTo(0); expect(t.pivot[1]).toBeCloseTo(0.1); expect(t.pivot[2]).toBeCloseTo(-0.05);
    expect(t.yaw).toBeCloseTo(0);

    const split = splitTurrets(g)!;
    expect(split).not.toBeNull();
    expect(splitTurrets(g)).toBe(split); // zwischengespeichert / cached
    expect(split.hull.getAttribute('position').count).toBe(2 * BOX);
    expect(split.turrets).toHaveLength(1);
    const tg = split.turrets[0].geometry;
    expect(tg.getAttribute('position').count).toBe(2 * BOX);
    // alle Attribute uebernommen / all attributes copied
    expect(Object.keys(tg.attributes).sort()).toEqual(Object.keys(g.attributes).sort());
    // Drehpunkt im Ursprung: Turmkoerper sitzt ueber y=0, Rohr zeigt nach +z / pivot at the origin: body above y=0, barrel along +z
    tg.computeBoundingBox();
    const bb = tg.boundingBox!;
    expect(bb.min.y).toBeCloseTo(0);
    expect(bb.min.x).toBeCloseTo(-0.075);
    expect(bb.max.z).toBeCloseTo(0.25);
    expect(split.turrets[0].pivot.toArray().map((v) => +v.toFixed(4))).toEqual([0, 0.1, -0.05]);
  });

  it('Heckturm: Ruherichtung PI, Rohr der Teilgeometrie nach +z / aft turret: rest PI, barrel of the part along +z', () => {
    const b = new Builder();
    b.box(0.3, 0.1, 0.6, '#808080', [0, 0.05, 0]);
    b.group({ p: [0, 0.1, -0.2], r: [0, Math.PI, 0] }, () => b.turret([0, 0, 0], () => {
      b.box(0.1, 0.05, 0.1, '#606060', [0, 0.025, 0]);
      b.box(0.02, 0.02, 0.12, '#404040', [0, 0.03, 0.1]);
    }, { arc: 2 }));
    const g = b.build();
    const [t] = turretsOf(g);
    expect(Math.abs(t.yaw)).toBeCloseTo(Math.PI);
    expect(t.arc).toBe(2);
    expect(t.pivot[2]).toBeCloseTo(-0.2);
    const part = splitTurrets(g)!.turrets[0];
    part.geometry.computeBoundingBox();
    expect(part.geometry.boundingBox!.max.z).toBeCloseTo(0.16);
    expect(part.arc).toBe(2);
  });

  it('verschachtelte Tuerme sind ein Fehler / nested turrets are an error', () => {
    const b = new Builder();
    expect(() => b.turret([0, 0, 0], () => b.turret([0, 0, 0], () => {}))).toThrow();
  });
});

describe('Einheiten mit Turm / units with a turret', () => {
  const tanks: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];
  it('alle fuenf Panzerbauarten (voll und vereinfacht) haben genau einen Turm / all five tank designs (full and lite) have exactly one turret', () => {
    for (const f of tanks) {
      for (const lite of [false, true]) {
        const g = tank(f, lite).build();
        const t = turretsOf(g);
        expect(t, `${f} lite=${lite}`).toHaveLength(1);
        // Turm deutlich kleiner als die Wanne, Rohr vorn / turret clearly smaller than the hull, barrel in front
        expect(t[0].count).toBeGreaterThan(0);
        expect(t[0].count).toBeLessThan(g.getAttribute('position').count);
      }
    }
  });

  it('Vergroesserung nimmt den Drehpunkt mit / the enlargement carries the pivot along', () => {
    for (const f of tanks) {
      const raw = turretsOf(tank(f).build())[0];
      const g = unitGeometry('tank', f, null);
      const t = turretsOf(g)[0];
      const k = g.userData.finishScale as number;
      expect(t.pivot[1]).toBeCloseTo(raw.pivot[1] * k, 5);
      expect(t.pivot[2]).toBeCloseTo(raw.pivot[2] * k, 5);
      const split = splitTurrets(g)!;
      expect(split.hull.getAttribute('position').count + split.turrets[0].geometry.getAttribute('position').count).toBe(g.getAttribute('position').count);
    }
  });

  it('weitere Turmeinheiten / further turret units', () => {
    const want: [UnitTypeId, FactionId, number][] = [
      ['antiAir', 'korvat', 1], ['antiAir', 'meridon', 1], ['antiAir', 'velkar', 1], ['reliquary', 'alvenia', 1], ['titan', 'nexus', 1],
      ['destroyer', 'dravon', 2], ['battleship', 'korvat', 3],
      // Steppenkoloss (Korvat) und Flammenwerferpanzer (NEXUS) / Steppe Colossus (Korvat) and flamethrower tank (NEXUS)
      ['steppeColossus', 'korvat', 1], ['flameTank', 'nexus', 1],
    ];
    for (const [type, f, n] of want) expect(turretsOf(unitGeometry(type, f, null)), `${type} ${f}`).toHaveLength(n);
    // ohne Turm: Infanterie, Tesla-Panzer (feste Spulen) / without a turret: infantry, Tesla tank (fixed coils)
    expect(turretsOf(unitGeometry('infantry', 'korvat', null))).toHaveLength(0);
    expect(turretsOf(unitGeometry('teslaTank', 'velkar', null))).toHaveLength(0);
  });
});

describe('Zielen / aiming', () => {
  it('ohne Ziel Ruhestellung, mit Ziel relativ zur Wanne / no target = rest, with a target relative to the hull', () => {
    expect(turretYaw(0, undefined, undefined)).toBe(0);
    expect(turretYaw(Math.PI, undefined, undefined)).toBe(Math.PI);
    expect(turretYaw(0, undefined, 1.2)).toBeCloseTo(1.2);
    expect(turretYaw(0, undefined, -2.5)).toBeCloseTo(-2.5);
  });

  it('Schwenkgrenze haelt Hecktuerme von den Aufbauten fern / traverse limit keeps aft turrets off the superstructure', () => {
    const arc = (Math.PI * 3) / 4;
    // Heckturm (Ruhe PI), Ziel genau voraus: bleibt 135 Grad von hinten / aft turret (rest PI), target dead ahead: stays 135 degrees from aft
    const y = turretYaw(Math.PI, arc, 0.01);
    expect(Math.abs(Math.atan2(Math.sin(y - Math.PI), Math.cos(y - Math.PI)))).toBeCloseTo(arc);
    // innerhalb der Grenze unveraendert / inside the limit unchanged
    expect(Math.cos(turretYaw(Math.PI, arc, Math.PI / 2) - Math.PI / 2)).toBeCloseTo(1);
  });

  it('Muendung folgt dem Turm, nicht der Wanne / the muzzle follows the turret, not the hull', () => {
    const o = new THREE.Vector3(1, 0, 2);
    // Drehpunkt 0.05 hinter der Mitte, Muendung 0.4 vor der Mitte / pivot 0.05 behind the centre, muzzle 0.4 ahead
    const q = new THREE.Vector3(0, 0.2, -0.05);
    const ahead = turretMuzzle(o, q, 0, 0, 0.25, 0.4);
    expect(ahead.x).toBeCloseTo(1); expect(ahead.y).toBeCloseTo(0.25); expect(ahead.z).toBeCloseTo(2.4);
    // Wanne nach vorn (+z), Turm nach +x: Muendung 0.45 rechts vom Drehpunkt / hull forward, turret towards +x: muzzle 0.45 right of the pivot
    const side = turretMuzzle(o, q, 0, Math.PI / 2, 0.25, 0.4);
    expect(side.x).toBeCloseTo(1.45); expect(side.z).toBeCloseTo(1.95);
    // Wanne nach +x gedreht, Turm zielt nach -z / hull turned to +x, turret aims at -z
    const back = turretMuzzle(o, q, Math.PI / 2, Math.PI, 0.25, 0.4);
    expect(back.x).toBeCloseTo(1 - 0.05); expect(back.z).toBeCloseTo(2 - 0.45);
  });
});
