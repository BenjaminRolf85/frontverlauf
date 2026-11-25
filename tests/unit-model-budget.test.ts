/**
 * Einheitenmodelle: Dreiecksbudget je Typ und Detailstufe, glatte Normalen, eine Geometrie je Einheit.
 * Die Tuschelinie zeichnet jede Einheit ein zweites Mal, ein spaetes Spiel hat ueber hundert Einheiten im Bild: darum
 * sind die Obergrenzen hier festgeschrieben. Wer ein Modell ausbaut, muss die Grenze bewusst anheben.
 * Unit models: triangle budget per type and detail level, smooth normals, one geometry per unit.
 * The ink line draws every unit a second time and a late game has over a hundred units on screen: that is why the
 * ceilings are pinned here. Extending a model means raising its limit deliberately.
 */
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getUnitQuality, setUnitQuality, unitGeometry, unitTriLimit, type UnitQuality } from '../src/render/models';
import { Builder, capsule, lathe, softBox, softPrism, splitTurrets, taperSoft, turretsOf, withDetail } from '../src/render/models/kit';
import {
  ALIEN_UNITS, ALVENIA_UNITS, CULT_UNITS, KORVAT_UNITS, MERIDON_UNITS, ROBOT_UNITS, UNIQUE, VELKAR_UNITS, type FactionId, type UnitTypeId,
} from '../src/data/balance';

const HUMANS: FactionId[] = ['korvat', 'dravon', 'alvenia', 'meridon', 'velkar'];
const tris = (g: THREE.BufferGeometry) => g.getAttribute('position').count / 3;

/**
 * Obergrenzen in Dreiecken je Einheitentyp: [hohe Qualitaet, niedrige Qualitaet, Stand vor dem Feinschliff], jeweils
 * die groesste der geprueften Fraktionen. Die Grenzen sind nach dem Feinschliff gemessen und mit rund 5 % Luft
 * aufgerundet. Niedrig darf je Typ hoechstens LOW_SLACK ueber dem alten Stand liegen und liegt in der Summe darunter.
 * Ceilings in triangles per unit type: [high quality, low quality, state before the polish], each the largest of the
 * checked factions. The limits were measured after the polish and rounded up with about 5 % headroom. Low may exceed
 * the old state by at most LOW_SLACK per type and is below it in total.
 */
const LOW_SLACK = 1.03;
/**
 * Bewusst ausgebaute Modelle (Feinschliff Runde 3, vorher die groebsten): fuer sie gilt die Vorher-Grenze der niedrigen
 * Qualitaet nicht, nur ihre eigene Grenze in BUDGET. Keines davon steht in der Szene des spaeten Spiels der Grundfraktionen.
 * Ebenso neue Modelle ohne Vorher-Stand (Marines der Meridon).
 * Deliberately extended models (polish round 3, before the coarsest ones): the before limit of low quality does not apply
 * to them, only their own limit in BUDGET. None of them is in the late-game scene of the base factions. Likewise new models
 * without a before state (Meridon's marines).
 */
const RAISED = new Set(['kamikazeDrone', 'flakDrone', 'fogCutter', 'guidedMissile', 'marine', 'berserker', 'divineSpark']);
const BUDGET: Record<string, [number, number, number]> = {
  // Typ: [hoch, niedrig, vorher], // gemessen hoch / niedrig / type: [high, low, before], // measured high / low
  infantry: [11650, 4550, 4891], // 11078 / 4300 (Detailrunde 4, vorher 5453 / detail round 4, before 5453)
  sniper: [13300, 6050, 6285], // 12620 / 5720 (Detailrunde 4, vorher 6865 / detail round 4, before 6865)
  jeep: [6350, 5300, 5140], // 6018 / 5028
  pioneer: [12700, 5250, 5321], // 12090 / 4972 (Detailrunde 4, vorher 6189 / detail round 4, before 6189)
  mg: [14500, 4750, 5075], // 13803 / 4515 (Detailrunde 4, vorher 5286 / detail round 4, before 5286)
  medic: [11850, 5350, 5703], // 11254 / 5064 (Detailrunde 4, vorher 6273 / detail round 4, before 6273)
  artillery: [6400, 5700, 5839], // 6095 / 5419
  spy: [8100, 3100, 3237], // 7702 / 2908 (Detailrunde 4, vorher 4089 / detail round 4, before 4089)
  heli: [3900, 3900, 4007], // 3695 / 3695
  tank: [8400, 7850, 7866], // 7983 / 7472
  antiTank: [4750, 3950, 3945], // 4520 / 3749
  antiAir: [5700, 5500, 6024], // 5412 / 5220
  mineLayer: [6400, 6050, 6430], // 6085 / 5718
  landingBoat: [2400, 2150, 2276], // 2259 / 2020
  submarine: [4050, 3900, 3792], // 3849 / 3674
  destroyer: [5700, 5550, 5748], // 5422 / 5280
  battleship: [6800, 6650, 7131], // 6449 / 6307
  grey: [4350, 4300, 4264], // 4136 / 4072
  terraformer: [4500, 4500, 4312], // 4240 / 4240
  skimmer: [4450, 4450, 4756], // 4228 / 4228
  mech: [6700, 6300, 6364], // 6348 / 5964
  tripod: [7500, 7500, 7937], // 7099 / 7099
  zealot: [10150, 4900, 4716], // 9646 / 4656 (Detailrunde 4, vorher 5576 / detail round 4, before 5576)
  torchbearer: [10450, 5100, 4984], // 9918 / 4848 (Detailrunde 4, vorher 5768 / detail round 4, before 5768)
  prophet: [10200, 4800, 5026], // 9680 / 4534 (Detailrunde 4, vorher 5454 / detail round 4, before 5454)
  doomBuggy: [7700, 4800, 5576], // 7296 / 4556 (Detailrunde 4, vorher 5240 / detail round 4, before 5240)
  rocketCart: [8100, 5500, 5392], // 7702 / 5218 (Detailrunde 4, vorher 5834 / detail round 4, before 5834)
  doomCrawler: [9650, 7350, 8023], // 9159 / 6983 (Detailrunde 4, vorher 7247 / detail round 4, before 7247)
  faustZealot: [6200, 5250, 4967], // 5883 / 4963
  // neu (Berserker des Kults), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (the cult's berserker), no before state: before holds its own low value
  berserker: [8450, 2950, 2808], // 8004 / 2808 (Detailrunde 4, vorher 3824 / detail round 4, before 3824)
  android: [4700, 4300, 4376], // 4472 / 4088
  cyborg: [4500, 3850, 3692], // 4276 / 3636
  kamikazeDrone: [4600, 3800, 3864], // 4364 / 3616 (Feinschliff Runde 3 / polish round 3)
  spider: [4750, 4600, 4456], // 4492 / 4364
  quadDrone: [4450, 4400, 4742], // 4230 / 4166
  flakDrone: [3800, 2400, 2074], // 3602 / 2242 (Feinschliff Runde 3 / polish round 3)
  railgun: [5950, 5650, 5580], // 5636 / 5380
  flameTank: [7450, 7200, 7006], // 7070 / 6814
  titan: [7000, 6100, 5772], // 6620 / 5788
  steppeRider: [11000, 3500, 3367], // 10437 / 3329 (Detailrunde 4, vorher 3941 / detail round 4, before 3941)
  stormbreaker: [12500, 4450, 4681], // 11886 / 4216 (Detailrunde 4, vorher 5275 / detail round 4, before 5275)
  peacekeeper: [15850, 7100, 7414], // 15091 / 6737 (Detailrunde 4, vorher 8450 / detail round 4, before 8450)
  privateer: [8000, 3200, 3388], // 7598 / 3008 (Detailrunde 4, vorher 3008 / detail round 4, before 3008)
  protoWalker: [6700, 4300, 4260], // 6360 / 4068 (Detailrunde 4, vorher 4324 / detail round 4, before 4324)
  teslaTank: [7550, 7400, 7212], // 7188 / 7008
  octocopter: [4500, 4500, 4876], // 4252 / 4252
  railSniper: [5950, 4750, 4951], // 5635 / 4482
  lightWarden: [8600, 6850, 7252], // 8178 / 6477
  reliquary: [6250, 6050, 6278], // 5910 / 5750
  sunLance: [5100, 4550, 5013], // 4843 / 4295
  // neu (Goettlicher Funke der Alvenia, Riesengeschuetz), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (Alvenia's Divine Spark, giant gun), no before state: before holds its own low value
  divineSpark: [7450, 6650, 6338], // 7390 / 6296 (Landkreuzer, vorher 7081 / 6338 / land cruiser, before 7081 / 6338)
  steppeColossus: [9350, 8800, 8643], // 8868 / 8369
  shadowCommando: [5150, 3800, 3531], // 4883 / 3613 (Lesbarkeit: Sprengrucksack / readability: demolition pack)
  fogCutter: [2250, 1800, 704], // 2096 / 1680 (Feinschliff Runde 3 / polish round 3)
  guidedMissile: [4200, 1400, 668], // 3976 / 1324 (Feinschliff Runde 3 / polish round 3)
  radarTruck: [4200, 3600, 3470], // 3962 / 3386
  // neu (Marines statt Infanterie, Meridon), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (marines instead of infantry, Meridon), no before state: before holds its own low value
  marine: [5150, 3900, 3698], // 4874 / 3698
  swarmMother: [16350, 16250, 15432], // 15560 / 15432
  scientist: [8300, 3150, 3038], // 7886 / 2998 (Detailrunde 4, vorher 4102 / detail round 4, before 4102)
};

/** Typen und die Fraktionen, mit denen sie gebaut werden / types and the factions they are built with */
function cases(): [UnitTypeId, FactionId][] {
  const out: [UnitTypeId, FactionId][] = [];
  const land: UnitTypeId[] = ['infantry', 'sniper', 'jeep', 'pioneer', 'mg', 'medic', 'artillery', 'spy', 'heli', 'tank', 'antiTank', 'antiAir', 'mineLayer'];
  const ships: UnitTypeId[] = ['landingBoat', 'submarine', 'destroyer', 'battleship'];
  for (const t of [...land, ...ships]) for (const f of HUMANS) out.push([t, f]);
  for (const t of ALIEN_UNITS) out.push([t, 'zyrr']);
  for (const t of CULT_UNITS) out.push([t, 'vesper']);
  for (const t of ROBOT_UNITS) out.push([t, 'nexus']);
  for (const [f, t] of Object.entries(UNIQUE.units)) out.push([t as UnitTypeId, f as FactionId]);
  for (const t of VELKAR_UNITS) out.push([t, 'velkar']);
  for (const t of ALVENIA_UNITS) out.push([t, 'alvenia']);
  for (const t of KORVAT_UNITS) out.push([t, 'korvat']);
  for (const t of MERIDON_UNITS) out.push([t, 'meridon']);
  out.push(['flakDrone', 'nexus'], ['faustZealot', 'vesper'], ['swarmMother', 'zyrr'], ['scientist', 'korvat']);
  // doppelte Paare entfernen / drop duplicate pairs
  const seen = new Set<string>();
  return out.filter(([t, f]) => (seen.has(`${t}|${f}`) ? false : (seen.add(`${t}|${f}`), true)));
}

/** Summe ueber alle geprueften Modelle: [hoch, niedrig]; vor dem Feinschliff waren es 603819 / sum over all checked models: [high, low]; before the polish it was 603819 */
// hoch um das Budget des neuen Berserker-Modells angehoben (651000 + 4050), niedrig unveraendert (passt weiter)
// high raised by the budget of the new berserker model (651000 + 4050), low unchanged (still fits)
// hoch um das Budget des Goettlichen Funkens angehoben (655050 + 7450) / high raised by the budget of the Divine Spark (655050 + 7450)
// Detailrunde 4: hoch vorlaeufig weit gefasst, wird nach dem Zusammenfuehren auf den Messwert + 5 % gesetzt
// detail round 4: high provisionally wide, set to the measured value + 5 % after the merge
const SUMME: [number, number] = [1400000, 568000];
/** Stand vor dem Feinschliff (gleiche Modelle, eine Detailstufe) / state before the polish (same models, one detail level) */
const BEFORE_SUM = 603819;

describe('Einheitenmodelle: Budget / unit models: budget', () => {
  const start = getUnitQuality();
  afterAll(() => setUnitQuality(start));

  for (const [qi, q] of (['high', 'low'] as UnitQuality[]).entries()) {
    it(`Dreiecke je Typ unter der Obergrenze (${q}) / triangles per type below the ceiling (${q})`, () => {
      setUnitQuality(q);
      let sum = 0;
      const over: string[] = [];
      const max = new Map<string, number>();
      for (const [t, f] of cases()) {
        const n = tris(unitGeometry(t, f, null));
        sum += n;
        max.set(t, Math.max(max.get(t) ?? 0, n));
        const limit = BUDGET[t]?.[qi];
        expect(limit, `budget for ${t}`).toBeGreaterThan(0);
        if (n > limit) over.push(`${t} ${f}: ${n} > ${limit}`);
        if (n > unitTriLimit(q, t === 'swarmMother')) over.push(`${t} ${f}: ${n} above the model ceiling`);
      }
      // niedrige Qualitaet: kein Typ nennenswert teurer als vor dem Feinschliff / low quality: no type notably more expensive than before the polish
      if (q === 'low') for (const [t, n] of max) if (!RAISED.has(t) && n > BUDGET[t][2] * LOW_SLACK) over.push(`${t}: low ${n} > before ${BUDGET[t][2]}`);
      expect(over).toEqual([]);
      expect(sum).toBeLessThanOrEqual(SUMME[qi]);
      // niedrige Qualitaet bleibt unter dem Stand vor dem Feinschliff / low quality stays below the pre-polish state
      if (q === 'low') expect(sum).toBeLessThan(BEFORE_SUM);
    }, 180_000);
  }

  it('niedrig ist nie teurer als hoch / low is never more expensive than high', () => {
    for (const [t, f] of cases()) {
      setUnitQuality('high');
      const hi = tris(unitGeometry(t, f, null));
      setUnitQuality('low');
      const lo = tris(unitGeometry(t, f, null));
      expect(lo, `${t} ${f}`).toBeLessThanOrEqual(hi);
    }
  }, 180_000);

  it('eine Geometrie je Einheit, Tuerme unveraendert, Normalen gueltig / one geometry per unit, turrets unchanged, valid normals', () => {
    for (const q of ['high', 'low'] as UnitQuality[]) {
      setUnitQuality(q);
      for (const [t, f] of [['infantry', 'korvat'], ['tank', 'korvat'], ['tank', 'dravon'], ['jeep', 'meridon'], ['battleship', 'alvenia'], ['heli', 'velkar'], ['mech', 'zyrr'], ['titan', 'nexus']] as [UnitTypeId, FactionId][]) {
        const g = unitGeometry(t, f, null);
        expect(g.index, `${t} indexed`).toBeNull();
        for (const a of ['position', 'normal', 'color']) expect(g.getAttribute(a), `${t} ${a}`).toBeTruthy();
        expect(g.getAttribute('normal').count).toBe(g.getAttribute('position').count);
        const n = g.getAttribute('normal');
        for (let i = 0; i < n.count; i++) {
          const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
          if (!(l > 0.98 && l < 1.02)) throw new Error(`${t} ${f} ${q}: normal ${i} has length ${l}`);
        }
        // Zeichenaufrufe: Wanne + Tuerme wie bisher / draw calls: hull + turrets as before
        if (t === 'tank') expect(turretsOf(g), `${t} ${f}`).toHaveLength(1);
        if (t === 'infantry' || t === 'jeep') expect(turretsOf(g), `${t} ${f}`).toHaveLength(0);
        const split = splitTurrets(g);
        if (split) expect(tris(split.hull) + split.turrets.reduce((s, x) => s + tris(x.geometry), 0)).toBe(tris(g));
      }
    }
  });

  it('beide Detailstufen liegen getrennt im Zwischenspeicher / both detail levels are cached separately', () => {
    setUnitQuality('high');
    const hi = unitGeometry('infantry', 'dravon', null);
    setUnitQuality('low');
    const lo = unitGeometry('infantry', 'dravon', null);
    expect(lo).not.toBe(hi);
    expect(unitGeometry('infantry', 'dravon', null)).toBe(lo);
    setUnitQuality('high');
    expect(unitGeometry('infantry', 'dravon', null)).toBe(hi);
    // Groesse und Sockelbezug bleiben gleich / size and footprint stay the same
    for (const g of [hi, lo]) g.computeBoundingBox();
    expect(lo.boundingBox!.max.y).toBeCloseTo(hi.boundingBox!.max.y, 2);
  });
});

describe('Weiche Formen / soft shapes', () => {
  /** alle Dreiecke zeigen nach aussen, Normalen haben Laenge 1 / all triangles face outward, normals have unit length */
  function outward(g: THREE.BufferGeometry, name: string) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    expect(p.count % 3, name).toBe(0);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3();
    for (let t = 0; t < p.count; t += 3) {
      a.fromBufferAttribute(p, t); b.fromBufferAttribute(p, t + 1); c.fromBufferAttribute(p, t + 2);
      fn.copy(b).sub(a).cross(c.clone().sub(a));
      if (fn.lengthSq() < 1e-16) continue;
      const sum = new THREE.Vector3();
      for (let k = 0; k < 3; k++) {
        vn.fromBufferAttribute(n, t + k);
        expect(vn.length(), `${name} normal length`).toBeCloseTo(1, 3);
        sum.add(vn);
      }
      // Wicklung gegen die gemittelte Eckennormale / winding against the averaged vertex normal
      expect(fn.dot(sum), `${name} triangle ${t / 3} winding`).toBeGreaterThan(0);
    }
  }

  it('softBox: 44 Dreiecke, Masse stimmen, Flaechen flach, Fasen weich / 44 triangles, exact size, flat faces, soft bevels', () => {
    const g = softBox(0.2, 0.1, 0.3, 0.02);
    expect(tris(g)).toBe(44);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.toArray().map((v) => +v.toFixed(4))).toEqual([0.1, 0.05, 0.15]);
    expect(g.boundingBox!.min.toArray().map((v) => +v.toFixed(4))).toEqual([-0.1, -0.05, -0.15]);
    outward(g, 'softBox');
    // nur sechs verschiedene Normalen: die der Flaechen / only six distinct normals: those of the faces
    const n = g.getAttribute('normal'), set = new Set<string>();
    for (let i = 0; i < n.count; i++) set.add([n.getX(i), n.getY(i), n.getZ(i)].map((v) => Math.round(v)).join(','));
    expect(set.size).toBe(6);
    expect(g.userData.smooth).toBe(true);
  });

  it('softBox mit Rundungsschritten bleibt in den Massen / softBox with rounding steps keeps its size', () => {
    for (const n of [1, 2]) {
      const g = softBox(0.2, 0.1, 0.3, 0.03, n);
      expect(tris(g)).toBe(6 * (2 * n + 1) ** 2 * 2);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.x).toBeCloseTo(0.1, 5);
      expect(g.boundingBox!.max.y).toBeCloseTo(0.05, 5);
      expect(g.boundingBox!.max.z).toBeCloseTo(0.15, 5);
      outward(g, `softBox n=${n}`);
    }
  });

  it('softPrism, Verjuengung, Drehkoerper und Kapsel zeigen nach aussen / prism, taper, turned part and capsule face outward', () => {
    expect(tris(softPrism(0.2, 0.1, 0.3, 0.03))).toBe(28);
    outward(softPrism(0.2, 0.1, 0.3, 0.03), 'softPrism');
    const t = taperSoft(softBox(0.2, 0.1, 0.3, 0.02), 0.1, 0.5, 0.6, 0.02);
    t.computeBoundingBox();
    // breiteste Stelle knapp ueber der Unterkante (dort beginnt die Fase) / widest just above the bottom edge (where the bevel starts)
    expect(t.boundingBox!.max.x).toBeGreaterThan(0.085);
    expect(t.boundingBox!.max.x).toBeLessThanOrEqual(0.1);
    outward(t, 'taperSoft');
    outward(lathe([[0, 0], [0.1, 0, true], [0.1, 0.2, true], [0.06, 0.25], [0, 0.26]], 12), 'lathe up');
    outward(lathe([[0, 0.26], [0.06, 0.25], [0.1, 0.2, true], [0.1, 0, true], [0, 0]], 12), 'lathe down');
    const c = capsule(0.03, 0.025, 0.12, 8, 2);
    expect(tris(c)).toBe(8 * 4 * 2);
    c.computeBoundingBox();
    expect(c.boundingBox!.max.y).toBeCloseTo(0.06, 5);
    expect(c.boundingBox!.min.y).toBeCloseTo(-0.06, 5);
    outward(c, 'capsule');
  });

  it('Builder.add behaelt glatte Normalen, auch gespiegelt und skaliert / Builder.add keeps smooth normals, also mirrored and scaled', () => {
    const b = new Builder();
    b.mirrorX(() => b.add(softBox(0.1, 0.1, 0.1, 0.02, 1), '#808080', { p: [0.2, 0, 0], s: [1, 2, 0.5], r: [0.3, 0.2, 0.1] }));
    outward(b.build(), 'mirrored soft box');
    // Feinbereich: Zylinder mit glattem Mantel, Deckel flach; ausserhalb wie bisher flach
    // fine scope: cylinder with a smooth side and flat caps; flat as before outside it
    // kleinste Uebereinstimmung von Normale und Radius am Mantel: glatt 1, flach cos(15 Grad)
    // smallest agreement of normal and radius on the side: smooth 1, flat cos(15 degrees)
    const side = (smooth: boolean) => {
      const bb = new Builder();
      withDetail(1, true, () => bb.cyl(0.1, 0.1, 0.2, 12, '#808080', [0, 0, 0]), { smooth });
      const g = bb.build(), n = g.getAttribute('normal'), p = g.getAttribute('position');
      let min = 1;
      for (let i = 0; i < n.count; i++) if (Math.abs(n.getY(i)) < 0.5) min = Math.min(min, (n.getX(i) * p.getX(i) + n.getZ(i) * p.getZ(i)) / Math.hypot(p.getX(i), p.getZ(i)));
      return min;
    };
    expect(side(true)).toBeGreaterThan(0.999);
    expect(side(false)).toBeLessThan(0.97);
  });
});
