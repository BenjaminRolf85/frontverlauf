/**
 * Stadtmodell: waechst je Stufe sichtbar, bleibt im Dreiecksbudget, das Hauptquartier ueberragt die Stadt.
 * City model: grows visibly per level, stays within the triangle budget, the headquarters towers above the city.
 */
import { describe, expect, it } from 'vitest';
import { BASES, BASE_KINDS, FACTION_IDS, type BaseKind, type FactionId } from '../src/data/balance';
import { CITY_SCALE, city, cityHeight, hqMastTop } from '../src/render/models/city';
import { base, baseGeometry, baseMeta, rotorGeometry } from '../src/render/models/bases';
import { cityGeometry } from '../src/render/models';
import { GARRISON, MARKER } from '../src/render/config';
import { look, mat } from '../src/render/models/look';
import type * as THREE from 'three';

const NONE = { hq: false, factory: false, bunkerRing: false, govQuarter: false };
const ALL = { hq: true, factory: true, bunkerRing: true, govQuarter: true };
const box = (f: FactionId | null, lv: number, flags = NONE) => {
  const g = city(f, lv, flags).build();
  g.computeBoundingBox();
  return { tris: g.getAttribute('position').count / 3, bb: g.boundingBox! };
};

describe('Stadtmodell / city model', () => {
  it('jede Stufe ist hoeher als die vorige und ab Stufe 3 hoeher als eine Einheit / every level is taller than the one before and from level 3 taller than a unit', () => {
    let last = 0;
    for (let lv = 1; lv <= 8; lv++) {
      const h = box('korvat', lv).bb.max.y;
      expect(h, `level ${lv}`).toBeGreaterThan(last + 0.03);
      expect(cityHeight(lv, false)).toBeLessThanOrEqual(h);
      last = h;
    }
    // Einheit: etwa 0.55 Feldbreiten hoch im Massstab 1.25 / unit: about 0.55 tile widths tall at scale 1.25
    expect(box('korvat', 3).bb.max.y).toBeGreaterThan(0.6);
    expect(box('korvat', 1).bb.max.y).toBeGreaterThan(0.3);
  });

  it('fuellt das Feld, ragt aber nicht darueber hinaus / fills the tile but does not reach beyond it', () => {
    for (const f of [null, ...FACTION_IDS]) for (const flags of [NONE, ALL]) {
      const { bb } = box(f, 5, flags);
      const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
      expect(ext, `${f}`).toBeGreaterThan(0.4 * CITY_SCALE - 0.01);
      // die grosse HQ-Flagge darf ueber die Kante wehen / the big HQ flag may fly across the edge
      if (!flags.hq) expect(ext, `${f}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('Hauptquartier: Mast ueber dem Wahrzeichen, Leuchtfeuer an der Mastspitze / headquarters: mast above the landmark, beacon at the mast top', () => {
    for (let lv = 1; lv <= 8; lv++) {
      const [x, y, z] = hqMastTop(lv);
      expect(y, `level ${lv}`).toBeGreaterThan(cityHeight(lv, false) + 0.15);
      const { bb } = box('korvat', lv, { ...NONE, hq: true });
      expect(Math.abs(bb.max.y - y)).toBeLessThan(0.12);
      expect(Math.abs(x)).toBeLessThan(0.5);
      expect(Math.abs(z)).toBeLessThan(0.5);
    }
  });

  it('Dreiecksbudget 6000 je Stadt (wie die Modellpruefung) / triangle budget 6000 per city (like the model check)', () => {
    for (const f of [null, ...FACTION_IDS]) for (let lv = 1; lv <= 8; lv++) for (const flags of [NONE, ALL]) {
      expect(box(f, lv, flags).tris, `${f} ${lv}`).toBeLessThanOrEqual(6000);
    }
  }, 60000);

  it('Besatzung: Ring beruehrt keinen Nachbarring, auch im Puls / garrison: ring touches no neighbouring ring, even in the pulse', () => {
    // Kamera diagonal: Besatzung um shift zur Ecke, Nachbar eine Feldbreite entfernt / camera diagonal: garrison shifted towards the corner, neighbour one tile away
    const d = GARRISON.shift * Math.SQRT1_2;
    const gap = Math.hypot(1 - d, d);
    const rings = MARKER.own.outer * (1 + MARKER.pulse) * (1 + GARRISON.scale);
    expect(gap).toBeGreaterThan(rings);
    // und bleibt auf dem eigenen Feld antippbar (Mitte naeher am eigenen Feld) / and stays tappable on its own tile
    expect(d).toBeLessThan(0.5);
  });
});

/**
 * Stuetzpunkte: je Art ein eigenes Modell im selben Rahmen wie die Stadt. Die Modelle haengen nicht von der
 * Qualitaetsstufe ab (wie die Staedte), deshalb gibt es nur eine Stufe zu pruefen.
 * Bases: one model per kind within the same frame as the city. The models do not depend on the quality level (like the
 * cities), so there is only one level to check.
 */
describe('Stuetzpunkt-Modelle / base models', () => {
  const OFF = { factory: false, bunkerRing: false, govQuarter: false };
  const ON = { factory: true, bunkerRing: true, govQuarter: true };
  const build = (k: BaseKind, f: FactionId | null, lv: number, flags = OFF, sea = 0) => {
    const { builder, meta } = base(k, f, lv, flags, sea);
    const g = builder.build();
    g.computeBoundingBox();
    return { g, meta, tris: g.getAttribute('position').count / 3, bb: g.boundingBox! };
  };

  it('Dreiecksbudget 6000: jede Art, Stufe und Fraktion, ohne und mit allen Ausbauten / triangle budget 6000: every kind, level and faction, without and with all extensions', () => {
    let worst = 0;
    for (const k of BASE_KINDS) for (const f of [null, ...FACTION_IDS]) for (let lv = 1; lv <= 8; lv++) for (const flags of [OFF, ON]) {
      const { tris } = build(k, f, lv, flags, lv % 4);
      worst = Math.max(worst, tris);
      expect(tris, `${k} ${f} ${lv}`).toBeLessThanOrEqual(6000);
      expect(tris, `${k} ${f} ${lv}`).toBeGreaterThan(300);
    }
    // deutlich unter dem Budget (gemessen 3576): Luft fuer spaetere Details / well below the budget (measured 3576): room for later detail
    expect(worst).toBeLessThanOrEqual(4000);
  }, 120000);

  it('bleibt auf dem Feld und fuellt es / stays on the tile and fills it', () => {
    for (const k of BASE_KINDS) for (const f of [null, 'korvat', 'zyrr', 'vesper', 'nexus'] as (FactionId | null)[]) for (const lv of [1, 4, 8]) for (let sea = 0; sea < (k === 'navalStation' ? 4 : 1); sea++) {
      const { bb } = build(k, f, lv, OFF, sea);
      const ext = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
      expect(ext, `${k} ${f} ${lv}`).toBeGreaterThan(0.4 * CITY_SCALE - 0.01);
      // nur die Spitzen der Rotorblaetter duerfen knapp ueber die Kante ragen / only the rotor blade tips may reach slightly across the edge
      expect(ext, `${k} ${f} ${lv}`).toBeLessThanOrEqual(0.53);
      expect(bb.min.y, `${k} ${f} ${lv}`).toBeGreaterThanOrEqual(-0.001);
    }
  });

  it('waechst mit der Stufe: mehr Bauteile und ein hoeheres Wahrzeichen / grows with the level: more parts and a taller landmark', () => {
    for (const k of BASE_KINDS) {
      const a = build(k, 'korvat', 1), m = build(k, 'korvat', 4), z = build(k, 'korvat', 8);
      expect(m.tris, k).toBeGreaterThan(a.tris);
      expect(z.tris, k).toBeGreaterThan(m.tris);
      expect(z.meta.height, k).toBeGreaterThan(a.meta.height);
      expect(z.bb.max.y, k).toBeGreaterThan(a.bb.max.y);
    }
  });

  it('verlassen: kein Rauch, keine Fenster, keine Lampen; besetzt: Fraktionsfarbe am Bordstein / abandoned: no smoke, no windows, no lamps; owned: faction colour on the kerb', () => {
    const has = (g: THREE.BufferGeometry, c: THREE.Color) => {
      const col = g.getAttribute('color');
      for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - c.r) + Math.abs(col.getY(i) - c.g) + Math.abs(col.getZ(i) - c.b) < 0.012) return true;
      return false;
    };
    for (const k of BASE_KINDS) {
      const n = build(k, null, 1), o = build(k, 'meridon', 3);
      expect(n.meta.smoke, k).toEqual([]);
      expect(has(n.g, mat.window), `${k} neutral window`).toBe(false);
      expect(has(n.g, mat.lamp), `${k} neutral lamp`).toBe(false);
      expect(has(o.g, look('meridon').primary), `${k} owned colour`).toBe(true);
      expect(has(n.g, look('meridon').primary), `${k} neutral colour`).toBe(false);
    }
    // Schlote rauchen nur dort, wo das Modell welche hat / stacks smoke only where the model has them
    expect(build('factory', 'korvat', 4).meta.smoke.length).toBeGreaterThanOrEqual(2);
    expect(build('windFarm', 'korvat', 4).meta.smoke).toEqual([]);
    expect(build('windFarm', 'korvat', 4, ON).meta.smoke.length).toBe(1);
  });

  it('Trefferkoerper liegen auf dem Feld, das Wahrzeichen ist so hoch wie gemeldet / hit bodies lie on the tile, the landmark is as tall as reported', () => {
    for (const k of BASE_KINDS) for (const lv of [1, 5, 8]) for (let sea = 0; sea < (k === 'navalStation' ? 4 : 1); sea++) {
      const { meta, bb } = build(k, 'korvat', lv, OFF, sea);
      expect(meta.hit.length, k).toBeGreaterThanOrEqual(2);
      for (const [x, z, w, h] of meta.hit) {
        expect(Math.abs(x) + w / 2, k).toBeLessThanOrEqual(0.56);
        expect(Math.abs(z) + w / 2, k).toBeLessThanOrEqual(0.56);
        expect(h, k).toBeGreaterThan(0.1);
        expect(h, k).toBeLessThanOrEqual(bb.max.y + 0.02);
      }
    }
  });

  it('deterministisch und zwischengespeichert, Staedte bleiben unveraendert / deterministic and cached, cities stay unchanged', () => {
    for (const k of BASE_KINDS) {
      const a = build(k, 'dravon', 5, ON, 1).g.getAttribute('position').array, b2 = build(k, 'dravon', 5, ON, 1).g.getAttribute('position').array;
      expect(a.length).toBe(b2.length);
      let same = true;
      for (let i = 0; i < a.length; i += 97) if (a[i] !== b2[i]) { same = false; break; }
      expect(same, k).toBe(true);
      const g = baseGeometry(k, 'dravon', 5, ON, 1);
      expect(baseGeometry(k, 'dravon', 5, ON, 1)).toBe(g);
      expect(baseMeta(g)?.hit.length).toBeGreaterThanOrEqual(2);
      // die Seeseite zaehlt nur beim Marinestuetzpunkt / the sea side only matters for the naval base
      expect(baseGeometry(k, 'dravon', 5, ON, 2) === g).toBe(k !== 'navalStation');
    }
    // ein Stuetzpunkt teilt keinen Schluessel mit einer Stadt / a base shares no key with a city
    expect(cityGeometry('dravon', 5, { hq: false, factory: true, bunkerRing: true, govQuarter: true }).name.startsWith('city|dravon')).toBe(true);
    expect(baseGeometry('factory', 'dravon', 5, ON).name.startsWith('city|base|factory')).toBe(true);
  });

  it('Windraeder: mit spin fehlen die Rotoren im Modell und werden gemeldet, verlassen stehen sie still / wind turbines: with spin the rotors are left out of the model and reported, abandoned they stand still', () => {
    for (const lv of [1, 4, 8]) {
      const fixed = base('windFarm', 'velkar', lv, OFF), turning = base('windFarm', 'velkar', lv, OFF, 0, true);
      const n = lv >= 4 ? 3 : 2;
      expect(fixed.meta.rotors).toEqual([]);
      expect(turning.meta.rotors.length).toBe(n);
      const rotor = rotorGeometry().getAttribute('position').count / 3;
      expect(fixed.builder.build().getAttribute('position').count / 3 - turning.builder.build().getAttribute('position').count / 3).toBe(n * rotor);
      for (const [x, y, z, , , scale] of turning.meta.rotors) {
        expect(Math.abs(x)).toBeLessThan(0.5); expect(Math.abs(z)).toBeLessThan(0.5);
        expect(y).toBeGreaterThan(0.5);
        expect(scale).toBeGreaterThan(0.9);
      }
      // verlassen: Rotor fest im Modell, auch mit spin / abandoned: rotor fixed in the model, with spin too
      expect(base('windFarm', null, lv, OFF, 0, true).meta.rotors).toEqual([]);
    }
    // andere Arten kennen kein spin: derselbe Zwischenspeicher-Eintrag / other kinds know no spin: the same cache entry
    expect(baseGeometry('factory', 'korvat', 2, OFF, 0, true)).toBe(baseGeometry('factory', 'korvat', 2, OFF, 0, false));
    expect(baseGeometry('windFarm', 'korvat', 2, OFF, 0, true)).not.toBe(baseGeometry('windFarm', 'korvat', 2, OFF, 0, false));
  });

  it('jede Art gehoert zu einer Gruppe der Lagekarte oder ist die Heimat-Kaserne / every kind belongs to a minimap group or is the home barracks', () => {
    const grouped = Object.values(BASES.groups).flat();
    for (const k of BASE_KINDS) expect(grouped.includes(k) || k === BASES.home, k).toBe(true);
  });
});
