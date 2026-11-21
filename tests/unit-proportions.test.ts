/**
 * Proportionen je Einheitentyp: Typen sollen sich in Masse und Umriss trennen, nicht nur in kleinen Teilen in der Hand.
 * Fusstruppen haben einen kleineren Helm, Groessenklassen (klein, mittel, breit, hoch, gross) und Schiffsklassen
 * (kurz, mittel, lang) sind hier festgeschrieben, ebenso die Grenzen auf dem Feld (Kachel 0.46, Hoehe 0.62 unter der
 * LP-Plakette); die wenigen Modelle, die schon vorher darueber lagen, duerfen nicht weiter wachsen.
 * Proportions per unit type: types should separate by mass and outline, not only by small held items. Foot troops have a
 * smaller helmet; size classes (small, medium, wide, tall, large) and ship classes (short, medium, long) are pinned here, as
 * are the limits on the tile (tile 0.46, height 0.62 below the HP badge); the few models that were already above them must
 * not grow further.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { getUnitQuality, setUnitQuality, unitGeometry, type UnitQuality } from '../src/render/models';
import { HEAD_CREW, HEAD_FOOT } from '../src/render/models/soldiers';
import { FACTION_IDS, UNITS, WONDER_UNITS, type FactionId, type UnitTypeId } from '../src/data/balance';

const HUMANS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];

/** Masse eines Einheitenmodells / dimensions of a unit model */
function dims(t: UnitTypeId, f: FactionId) {
  const g = unitGeometry(t, f, null);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  return {
    h: b.max.y,
    len: Math.max(-b.min.z, b.max.z),
    wid: Math.max(-b.min.x, b.max.x),
    ext: Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z),
    area: (b.max.x - b.min.x) * (b.max.z - b.min.z),
  };
}

/**
 * Modelle, die schon vor der Proportionsrunde ueber Kachel oder Hoehe lagen: Obergrenze = alter Stand (aufgerundet).
 * Models that were already above the tile or height limit before the proportion round: ceiling = old value (rounded up).
 */
const OVER: Partial<Record<UnitTypeId, { ext?: number; h?: number }>> = {
  reliquary: { ext: 0.51 }, sunLance: { ext: 0.5 }, steppeRider: { h: 0.77 }, sniper: { ext: 0.47 }, prophet: { h: 0.64 },
  swarmMother: { ext: 0.51, h: 1.76 },
};

describe('Einheiten: Proportionen / units: proportions', () => {
  const start = getUnitQuality();
  afterAll(() => setUnitQuality(start));

  it('Fusstruppen haben einen kleineren Helm als die Besatzungen / foot troops have a smaller helmet than crews', () => {
    // vorher 1.22 fuer alle; von oben deckte der Helm fast die ganze Figur / before 1.22 for all; from above the helmet covered almost the whole figure
    expect(HEAD_FOOT).toBeLessThanOrEqual(0.86);
    expect(HEAD_FOOT).toBeGreaterThanOrEqual(0.75);
    expect(HEAD_CREW).toBeGreaterThan(HEAD_FOOT);
    expect(HEAD_CREW).toBeLessThan(1.22);
  });

  for (const q of ['high', 'low'] as UnitQuality[]) {
    it(`Groessenklassen der Grundfraktionen (${q}) / size classes of the base factions (${q})`, () => {
      setUnitQuality(q);
      for (const f of HUMANS) {
        const d = (t: UnitTypeId) => dims(t, f);
        // klein: Spion und liegender Scharfschuetze; mittel: Schuetze; hoch: Sanitaeter / small: spy and prone sniper; medium: rifleman; tall: medic
        expect(d('spy').h, f).toBeLessThan(d('infantry').h - 0.04);
        expect(d('infantry').h, f).toBeLessThan(d('medic').h);
        expect(d('sniper').h, f).toBeLessThan(0.3);
        // breit: MG-Nest belegt mehr Flaeche als der Schuetze / wide: the MG nest covers more area than the rifleman
        expect(d('mg').area, f).toBeGreaterThan(d('infantry').area * 1.8);
        // leichte Wagen kleiner als Panzer / light cars smaller than tanks
        expect(d('jeep').area, f).toBeLessThan(d('tank').area * 0.75);
        // Minenleger lang und flach, Flak kurz und hoch / mine layer long and flat, AA short and tall
        expect(d('mineLayer').len, f).toBeGreaterThan(d('antiAir').len * 1.3);
        expect(d('mineLayer').h, f).toBeLessThan(d('antiAir').h * 0.72);
        // Schiffe: Landungsboot kurz, Zerstoerer mittel und schlank, Schlachtschiff lang und breit
        // ships: landing boat short, destroyer medium and slim, battleship long and wide
        expect(d('landingBoat').len, f).toBeLessThan(d('destroyer').len - 0.08);
        expect(d('destroyer').len, f).toBeLessThan(d('battleship').len - 0.03);
        expect(d('destroyer').wid, f).toBeLessThan(d('battleship').wid * 0.7);
      }
      // Schattenkommando tief geduckt, kleiner als der Schuetze / Shadow Commando deep crouch, smaller than the rifleman
      expect(dims('shadowCommando', 'meridon').h).toBeLessThan(dims('infantry', 'meridon').h * 0.75);
      // Marines (Meridon): breiter gebaut als der Schuetze, nicht niedriger, klar groesser als das geduckte Kommando
      // marines (Meridon): built broader than the rifleman, not lower, clearly larger than the crouched commando
      const mar = dims('marine', 'meridon'), inf = dims('infantry', 'meridon');
      expect(mar.wid).toBeGreaterThan(inf.wid * 1.2);
      expect(mar.h).toBeGreaterThanOrEqual(inf.h);
      expect(mar.h).toBeGreaterThan(dims('shadowCommando', 'meridon').h * 1.4);
    });

    it(`alle Einheiten bleiben auf dem Feld und unter der Plakette (${q}) / all units stay on the tile and below the badge (${q})`, () => {
      setUnitQuality(q);
      const types = (Object.keys(UNITS) as UnitTypeId[]).filter((t) => !(WONDER_UNITS as UnitTypeId[]).includes(t));
      const bad: string[] = [];
      for (const t of types) for (const f of FACTION_IDS) {
        const d = dims(t, f);
        const lim = OVER[t] ?? {};
        if (d.ext > (lim.ext ?? 0.46)) bad.push(`${t} ${f}: footprint ${d.ext.toFixed(3)}`);
        if (d.h > (lim.h ?? 0.625)) bad.push(`${t} ${f}: height ${d.h.toFixed(3)}`);
      }
      expect(bad).toEqual([]);
    }, 120_000);
  }
});
