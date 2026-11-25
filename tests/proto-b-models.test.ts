import { describe, expect, it } from 'vitest';
import { unitGeometry } from '../src/render/models';
import { splitTurrets } from '../src/render/models/kit';
import { bakeAO } from '../src/render/models/proto/b/ao';
import { protoRaw, type ProtoType } from '../src/render/models/proto/b';
import { inkGeometry } from '../src/render/models/proto/b/ink';
import { subdivide } from '../src/render/models/proto/b/uvkit';

// Vorschlag B (Prototyp): Geometrie mit uv fuer Schuetze und Panzer der Korvat / proposal B (prototype): geometry with uv for the Korvat rifleman and tank
describe('Vorschlag B / proposal B', () => {
  const types: ProtoType[] = ['infantry', 'tank'];

  it('liefert vollstaendige Attribute im Atlas / returns complete attributes inside the atlas', () => {
    for (const t of types) {
      const g = protoRaw(t, 'korvat').geometry;
      expect(g.index).toBeNull();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3], ['fx', 3]] as const) {
        const a = g.getAttribute(name);
        expect(a, `${t} ${name}`).toBeTruthy();
        expect(a.itemSize).toBe(size);
        expect(a.count).toBe(g.getAttribute('position').count);
        for (const v of a.array as Float32Array) if (!Number.isFinite(v)) throw new Error(`${t} ${name}: not finite`);
      }
      for (const v of g.getAttribute('uv').array as Float32Array) if (v < 0 || v > 1) throw new Error(`${t}: uv outside the atlas`);
    }
  });

  it('bleibt unter den Dreiecken der bisherigen Modelle / stays below the triangles of the current models', () => {
    for (const t of types) {
      const raw = protoRaw(t, 'korvat').geometry;
      const fill = subdivide(raw, t === 'tank' ? 0.085 : 0.05);
      const now = unitGeometry(t, 'korvat', null).getAttribute('position').count / 3;
      expect(fill.getAttribute('position').count / 3).toBeLessThan(now);
      // niedrige Qualitaet: weniger Rundungssegmente / low quality: fewer radial segments
      expect(protoRaw(t, 'korvat', true).geometry.getAttribute('position').count).toBeLessThan(raw.getAttribute('position').count);
    }
  });

  it('ist deterministisch / is deterministic', () => {
    for (const t of types) {
      const a = protoRaw(t, 'korvat').geometry, b = protoRaw(t, 'korvat').geometry;
      expect(Array.from(a.getAttribute('position').array as Float32Array)).toEqual(Array.from(b.getAttribute('position').array as Float32Array));
      expect(Array.from(a.getAttribute('uv').array as Float32Array)).toEqual(Array.from(b.getAttribute('uv').array as Float32Array));
    }
  });

  it('behaelt den Drehturm ueber Unterteilung und Verdeckung / keeps the turret across subdivision and occlusion', () => {
    const raw = protoRaw('tank', 'korvat').geometry;
    const fill = bakeAO(subdivide(raw, 0.085), { rays: 8 });
    const split = splitTurrets(fill);
    expect(split).not.toBeNull();
    expect(split!.turrets.length).toBe(1);
    expect(split!.hull.getAttribute('position').count + split!.turrets[0].geometry.getAttribute('position').count).toBe(fill.getAttribute('position').count);
    const ao = fill.getAttribute('ao').array as Float32Array;
    let lo = 1, hi = 0;
    for (const v of ao) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    // Fugen sind dunkler als freie Flaechen / joints are darker than open surfaces
    expect(lo).toBeLessThan(0.6);
  });

  it('zeichnet Innenlinien als Baender in einer Geometrie mit dem Umriss / draws inner lines as ribbons in one geometry with the silhouette', () => {
    for (const t of types) {
      const ink = inkGeometry(protoRaw(t, 'korvat').geometry);
      expect(ink.userData.creases).toBeGreaterThan(200);
      expect(ink.index!.count / 3).toBe(ink.userData.hullTriangles + ink.userData.creases * 2);
    }
  });
});
