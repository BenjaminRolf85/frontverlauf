/**
 * Stadtmodell: waechst je Stufe sichtbar, bleibt im Dreiecksbudget, das Hauptquartier ueberragt die Stadt.
 * City model: grows visibly per level, stays within the triangle budget, the headquarters towers above the city.
 */
import { describe, expect, it } from 'vitest';
import { FACTION_IDS, type FactionId } from '../src/data/balance';
import { CITY_SCALE, city, cityHeight, hqMastTop } from '../src/render/models/city';
import { GARRISON, MARKER } from '../src/render/config';

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
