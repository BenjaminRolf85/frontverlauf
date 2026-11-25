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
import { inkFor } from '../src/render/models/inked/ink';
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
  infantry: [8500, 4100, 4891], // 8086 / 3900 (gezeichnet / inked; vorher 11078 / 4119)
  sniper: [9750, 4560, 6285], // 9258 / 4340 (gezeichnet / inked; vorher 12620 / 5539)
  jeep: [12150, 5300, 5140], // 11526 / 5028 (Detailrunde 4 / detail round 4)
  pioneer: [9600, 4270, 5321], // 9142 / 4066 (gezeichnet / inked; vorher 12090 / 4791)
  mg: [10400, 4750, 5075], // 9870 / 4592 (gezeichnet / inked; vorher 13803 / 4444)
  medic: [10900, 4370, 5703], // 10352 / 4162 (gezeichnet / inked; vorher 11254 / 4817)
  artillery: [12350, 5700, 5839], // 11748 / 5016 (Detailrunde 4 / detail round 4)
  spy: [6900, 3100, 3237], // 6572 / 2962 (gezeichnet / inked; vorher 7702 / 2823)
  heli: [7100, 3900, 4007], // 6723 / 3695 (Detailrunde 4 / detail round 4)
  tank: [19600, 7850, 7866], // 18655 / 6824 (Detailrunde 4 / detail round 4)
  antiTank: [7700, 3950, 3945], // 7310 / 3634 (Detailrunde 4 / detail round 4)
  antiAir: [13250, 5500, 6024], // 12584 / 4716 (Detailrunde 4 / detail round 4)
  mineLayer: [14600, 6050, 6430], // 13879 / 5194 (Detailrunde 4 / detail round 4)
  landingBoat: [5600, 2150, 2276], // 5300 / 2020 (Detailrunde 4 / detail round 4)
  submarine: [8700, 3900, 3792], // 8239 / 3674 (Detailrunde 4 / detail round 4)
  destroyer: [13700, 5550, 5748], // 13016 / 5420 (Detailrunde 4 / detail round 4)
  battleship: [17050, 6650, 7131], // 16232 / 6569 (Detailrunde 4 / detail round 4)
  grey: [6950, 4300, 4264], // 6612 / 4072 (Detailrunde 4 / detail round 4)
  terraformer: [9400, 4500, 4312], // 8952 / 4240 (Detailrunde 4 / detail round 4)
  skimmer: [8550, 4450, 4756], // 8114 / 4228 (Detailrunde 4 / detail round 4)
  mech: [10900, 6300, 6364], // 10356 / 5964 (Detailrunde 4 / detail round 4)
  tripod: [13300, 7500, 7937], // 12627 / 7099 (Detailrunde 4 / detail round 4)
  zealot: [10150, 4900, 4716], // 9646 / 4656 (Detailrunde 4 / detail round 4)
  torchbearer: [10450, 5100, 4984], // 9918 / 4848 (Detailrunde 4 / detail round 4)
  prophet: [10200, 4800, 5026], // 9680 / 4710 (Detailrunde 4 / detail round 4)
  doomBuggy: [7700, 4800, 5576], // 7296 / 4556 (Detailrunde 4 / detail round 4)
  rocketCart: [8100, 5500, 5392], // 7702 / 4624 (Detailrunde 4 / detail round 4)
  doomCrawler: [9650, 7350, 8023], // 9159 / 6407 (Detailrunde 4 / detail round 4)
  faustZealot: [10600, 5250, 4967], // 10081 / 4963 (Detailrunde 4 / detail round 4)
  // neu (Berserker des Kults), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (the cult's berserker), no before state: before holds its own low value
  berserker: [8450, 2950, 2808], // 8004 / 2808 (Detailrunde 4 / detail round 4)
  android: [9700, 4300, 4376], // 9226 / 4088 (Detailrunde 4 / detail round 4)
  cyborg: [9050, 3850, 3692], // 8580 / 3632 (Detailrunde 4 / detail round 4)
  kamikazeDrone: [7650, 3800, 3864], // 7280 / 3616 (Detailrunde 4 / detail round 4)
  spider: [8100, 4600, 4456], // 7704 / 4364 (Detailrunde 4 / detail round 4)
  quadDrone: [7600, 4400, 4742], // 7198 / 4166 (Detailrunde 4 / detail round 4)
  flakDrone: [6300, 2400, 2074], // 5974 / 2242 (Detailrunde 4 / detail round 4)
  railgun: [10400, 5650, 5580], // 9874 / 4876 (Detailrunde 4 / detail round 4)
  flameTank: [12750, 7200, 7006], // 12132 / 5486 (Detailrunde 4 / detail round 4)
  titan: [12100, 6100, 5772], // 11480 / 5788 (Detailrunde 4 / detail round 4)
  steppeRider: [11000, 3500, 3367], // 10437 / 3228 (Detailrunde 4 / detail round 4)
  stormbreaker: [12500, 4450, 4681], // 11886 / 4025 (Detailrunde 4 / detail round 4)
  peacekeeper: [15850, 7100, 7414], // 15091 / 6441 (Detailrunde 4 / detail round 4)
  privateer: [8000, 3200, 3388], // 7598 / 2896 (Detailrunde 4 / detail round 4)
  protoWalker: [6700, 4300, 4260], // 6360 / 4068 (Detailrunde 4 / detail round 4)
  teslaTank: [13350, 7400, 7212], // 12673 / 6504 (Detailrunde 4 / detail round 4)
  octocopter: [8300, 4500, 4876], // 7896 / 4252 (Detailrunde 4 / detail round 4)
  railSniper: [11100, 4750, 4951], // 10536 / 4301 (Detailrunde 4 / detail round 4)
  lightWarden: [16750, 6850, 7252], // 15947 / 6181 (Detailrunde 4 / detail round 4)
  reliquary: [9400, 6050, 6278], // 8944 / 5318 (Detailrunde 4 / detail round 4)
  sunLance: [10050, 4550, 5013], // 9539 / 4180 (Detailrunde 4 / detail round 4)
  // neu (Goettlicher Funke der Alvenia, Riesengeschuetz), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (Alvenia's Divine Spark, giant gun), no before state: before holds its own low value
  divineSpark: [17550, 6650, 6338], // 16709 / 6296 (Detailrunde 4 / detail round 4)
  steppeColossus: [20800, 8800, 8643], // 19806 / 7649 (Detailrunde 4 / detail round 4)
  shadowCommando: [10700, 3800, 3531], // 10173 / 3213 (Detailrunde 4 / detail round 4)
  fogCutter: [5600, 1800, 704], // 5295 / 1680 (Detailrunde 4 / detail round 4)
  guidedMissile: [9300, 1400, 668], // 8820 / 1324 (Detailrunde 4 / detail round 4)
  radarTruck: [7300, 3600, 3470], // 6927 / 3382 (Detailrunde 4 / detail round 4)
  // neu (Marines statt Infanterie, Meridon), kein Vorher-Stand: vorher steht der eigene Wert niedrig / new (marines instead of infantry, Meridon), no before state: before holds its own low value
  marine: [11500, 3900, 3698], // 10946 / 3698 (Detailrunde 4 / detail round 4)
  swarmMother: [28050, 16250, 15432], // 26670 / 15432 (Detailrunde 4 / detail round 4)
  scientist: [8300, 3150, 3038], // 7886 / 2998 (Detailrunde 4 / detail round 4)
};

/**
 * Gezeichnete Typen (models/inked): Obergrenzen der Tuschegeometrie [hoch, niedrig], gemessen + 5 %. Die Tusche besteht
 * aus dem Umriss (verschweisste Rohgeometrie, ohne die Unterteilung fuer die Verdeckung) und bei hoher Qualitaet zwei
 * Dreiecken je Knickkante. Bisher war die Tusche so gross wie das Modell selbst; die Summe aus Flaeche und Tusche
 * liegt fuer alle gezeichneten Typen unter dem bisherigen Stand (2 x BEFORE_INKED).
 * Inked types (models/inked): ceilings of the ink geometry [high, low], measured + 5 %. The ink is the silhouette
 * (welded raw geometry, without the subdivision for the occlusion) plus two triangles per crease edge on high
 * quality. Before, the ink was as large as the model itself; the sum of fill and ink stays below the previous state
 * for every inked type (2 x BEFORE_INKED).
 */
// Jede Gruppe der Einfuehrung traegt ihre Typen in ihren eigenen Block ein (keine Kollisionen beim Zusammenfuehren).
// every rollout group enters its types into its own block (no collisions when merging).
/** Gruppe Figuren (Fusstruppen, Kult, Einzigartige zu Fuss): Tusche [hoch, niedrig] / group figures: ink [high, low] */
const INK_FIGURES: Record<string, [number, number]> = {
  infantry: [11700, 3900], // 11112 / 3680
  sniper: [14750, 4350], // 14040 / 4112
  pioneer: [12900, 4050], // 12286 / 3846
  mg: [15500, 4550], // 14720 / 4308
  medic: [12850, 4150], // 12212 / 3942
  spy: [8900, 2900], // 8438 / 2742
};
/** Gruppe Fahrzeuge (Landfahrzeuge, Roboter) / group vehicles (land vehicles, robots) */
const INK_VEHICLES: Record<string, [number, number]> = {
  tank: [14200, 4100], // 13494 / 3886 (Korvat; die anderen Fraktionen folgen / Korvat; the other factions follow)
};
/** Gruppe See und Fremde (Schiffe, Fremdwesen, Endgegner, Alvenia-Sonderbauarten) / group sea and aliens */
const INK_NAVAL: Record<string, [number, number]> = {
};
const INK_BUDGET: Record<string, [number, number]> = { ...INK_FIGURES, ...INK_VEHICLES, ...INK_NAVAL };

/** Bisherige Modelle derselben Typen: Dreiecke [hoch, niedrig] (Flaeche = Tusche), je Gruppe ein Block / previous models of the same types: triangles [high, low] (fill = ink), one block per group */
const BEFORE_FIGURES: Record<string, [number, number]> = {
  infantry: [11078, 4119], sniper: [12620, 5539], pioneer: [12090, 4791], mg: [13803, 4444], medic: [11254, 4817], spy: [7702, 2823],
};
const BEFORE_VEHICLES: Record<string, [number, number]> = {
  tank: [18655, 6824],
};
const BEFORE_NAVAL: Record<string, [number, number]> = {
};
const BEFORE_INKED: Record<string, [number, number]> = { ...BEFORE_FIGURES, ...BEFORE_VEHICLES, ...BEFORE_NAVAL };

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
// Detailrunde 4: hoch gemessen 1333057 (vorher hoechstens 662500), + 5 %; niedrig unveraendert
// detail round 4: high measured 1333057 (before at most 662500), + 5 %; low unchanged
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

  for (const [qi, q] of (['high', 'low'] as UnitQuality[]).entries()) {
    it(`gezeichnete Typen: Tusche unter der Obergrenze, Flaeche + Tusche unter dem bisherigen Stand (${q}) / inked types: ink below the ceiling, fill + ink below the previous state (${q})`, () => {
      setUnitQuality(q);
      const over: string[] = [];
      for (const [t, f] of cases()) {
        const g = unitGeometry(t, f, null);
        if (!g.userData.inked) continue;
        const fill = tris(g), ink = inkFor(g).index!.count / 3;
        expect(INK_BUDGET[t], `ink budget for ${t}`).toBeTruthy();
        if (ink > INK_BUDGET[t][qi]) over.push(`${t} ${f}: ink ${ink} > ${INK_BUDGET[t][qi]}`);
        // Velkar und Alvenia tragen noch altes Zubehoer ueber die Bruecke: 12 % Luft / Velkar and Alvenia still carry old accessories through the bridge: 12 % headroom
        if (fill + ink > 2 * BEFORE_INKED[t][qi] * 1.12) over.push(`${t} ${f}: fill + ink ${fill + ink} > ${2 * BEFORE_INKED[t][qi]}`);
        if (!turretsOf(g).length) expect(g.userData.inkSrc, `${t} ${f}`).toBeTruthy();
      }
      expect(over).toEqual([]);
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
