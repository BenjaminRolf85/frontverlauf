/**
 * Gezeichnete Figur: Kopfbedeckungen aller Fraktionen teilen eine Groessenklasse, Besatzungen einen Massstab.
 * Vorgabe des Auftraggebers: Koepfe, Helme und Huete werden nie einzeln vergroessert ("das muss einheitlich sein").
 * Inked figure: the headgear of all factions shares one size class, crews one scale. Owner's rule: heads, helmets and
 * hats are never enlarged separately (it has to be uniform).
 */
import { describe, expect, it } from 'vitest';
import { FACTION_IDS } from '../src/data/balance';
import { CREW, FIG, HEAD_SCALE } from '../src/render/models/inked/figure';
import { HAT_BRIM, HEAD_CLASS, headgearSize, HELM, spyHat } from '../src/render/models/inked/heads';
import { look } from '../src/render/models/look';

describe('Gezeichnete Figur: Kopfbedeckungen / inked figure: headgear', () => {
  it('alle Fraktionen innerhalb der Groessenklasse des Korvat-Helms / every faction within the size class of the Korvat helmet', () => {
    const ref = headgearSize('korvat', look('korvat'));
    expect(ref.w).toBeCloseTo(2 * 0.0525, 3);
    for (const f of FACTION_IDS) {
      const s = headgearSize(f, look(f));
      expect(Math.abs(s.w / ref.w - 1), `${f} width ${s.w.toFixed(4)} against ${ref.w.toFixed(4)}`).toBeLessThanOrEqual(HEAD_CLASS);
      expect(Math.abs(s.h / ref.h - 1), `${f} height ${s.h.toFixed(4)} against ${ref.h.toFixed(4)}`).toBeLessThanOrEqual(HEAD_CLASS);
    }
  });

  it('Helmkuppeln und Hutkrempen bleiben unter den festen Grenzen / helmet domes and hat brims stay below the fixed limits', () => {
    expect(HELM.R).toBeLessThanOrEqual(0.0535);
    for (const f of FACTION_IDS) {
      const hat = spyHat(f, look(f));
      expect(hat.brimR, f).toBeLessThanOrEqual(HAT_BRIM);
      expect(hat.crownR, f).toBeLessThanOrEqual(HELM.R);
    }
  });

  it('ein Massstab fuer Besatzungen, einer fuer Fusstruppen, ein Kopfmassstab / one scale for crews, one for foot troops, one head scale', () => {
    expect(CREW).toBe(0.6);
    expect(FIG).toBe(0.87);
    expect(HEAD_SCALE).toBe(1.3);
  });
});
