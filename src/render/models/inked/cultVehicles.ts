/**
 * Gezeichnete Einheiten: Schrottfahrzeuge des Kults der Letzten Stunde (Untergangs-Buggy, Raketenkarren,
 * Untergangs-Raupe).
 * Inked units: scrap vehicles of the Last Hour cult (doom buggy, rocket cart, doom crawler).
 *
 * Kennformen bleiben modelliert: beim Buggy Ueberrollkaefig, Stachelbuegel und Dach-MG, beim Karren das steil
 * aufgerichtete Gestell mit drei mal drei Raketen, bei der Raupe die breite Stachelschaufel, der Glockenturm und das
 * Banner. Bleche, Schweissnaehte, Flicken, Rost, Russ und die grobe Bemalung sind gezeichnet (cultVehiclesPaint.ts).
 * Besatzung: dieselbe Figur wie die Fusstruppen im einen Massstab CREW; wo der Platz nicht reichte, wurde das
 * Fahrzeug geaendert (offene Wanne beim Buggy, Luk im breiteren Fuehrerhaus der Raupe), nie die Figur.
 * The marks of identity stay modelled: the buggy's roll cage, spiked bar and roof MG, the cart's steeply raised rack
 * with three by three rockets, the crawler's wide spiked blade, bell tower and banner. Plates, weld seams, patches,
 * rust, soot and the crude paint are drawn (cultVehiclesPaint.ts). Crew: the same figure as the foot troops at the
 * one scale CREW; where room was short the vehicle was changed (open tub on the buggy, hatch in the crawler's wider
 * cab), never the figure.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, mix, shade, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { CREW, figure } from './figure';
import { antenna, can, HALF_PI, orb, spike, TIP, tube } from './robotKit';
import { emblemDecal, runningGear, wheel, type TrackSpec } from './trim';
import { AtlasLayout, loft, projectBox, UvBuilder } from './uvkit';

/** Scheinwerfer nach +z / headlight facing +z */
function headlight(b: UvBuilder, A: AtlasLayout, p: V3, r: number): void {
  const hi = fine();
  b.add(loft([{ y: 0.012, rx: r, hard: true }, { y: 0.012, rx: r * 1.2, hard: true }, { y: -0.008, rx: r }, { y: -0.012, rx: TIP }], { seg: hi ? 10 : 6, region: A.get('blank'), color: mat.gunmetal }), null, { xf: { p, r: [HALF_PI, 0, 0] } });
  b.add(loft([{ y: 0.0125, rx: r }, { y: 0.0155, rx: TIP }], { seg: hi ? 10 : 6, region: A.get('blank'), color: mat.lamp }), null, { xf: { p, r: [HALF_PI, 0, 0] }, gloss: 1, crease: 0 });
}

/** Dach-MG mit Schild in Fraktionsfarbe; p = Fuss der Lafette / roof MG with a shield in the faction colour; p = foot of the mount */
function roofMg(b: UvBuilder, A: AtlasLayout, L: Look, p: V3): void {
  const hi = fine();
  b.add(loft([{ y: 0.03, rx: 0.006 }, { y: 0, rx: 0.01 }], { seg: hi ? 8 : 5, region: A.get('blank'), color: mat.dark }), null, { xf: { p } });
  b.add(softBox(0.02, 0.026, 0.07, 0.005), mat.dark, { xf: { p: [p[0], p[1] + 0.04, p[2] + 0.012] }, gloss: 0.4 });
  tube(b, A, [p[0], p[1] + 0.043, p[2] + 0.04], [p[0], p[1] + 0.043, p[2] + 0.14], 0.006, 0.0052, mat.darkMid, { seg: hi ? 8 : 5, gloss: 0.6 });
  b.add(softBox(0.074, 0.046, 0.005, 0.002), L.primary, { xf: { p: [p[0], p[1] + 0.044, p[2] + 0.052], r: [-0.1, 0, 0] } });
}

/** Auspuffrohr mit Glut an der Muendung / exhaust pipe with ember glow at the mouth */
function exhaust(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, r: number): void {
  tube(b, A, a, c, r * 1.1, r, mat.rust, { seg: fine() ? 8 : 5, cell: 'exhaust', gloss: 0.1, crease: 0.6 });
  orb(b, A, [c[0], c[1] + r * 0.4, c[2]], r * 1.15, mat.ember, { seg: fine() ? 8 : 5, rows: fine() ? 4 : 3, gloss: 0 });
}

/** Banner an einer Stange: zerfetztes Tuch in der Ebene quer zur Stange, nach +z wehend / banner on a pole: tattered cloth in the plane across the pole, flying towards +z */
function pennant(b: UvBuilder, A: AtlasLayout, c: ColorLike, p: V3, w: number, h: number): void {
  const pts: [number, number][] = [[0, h / 2], [w, h * 0.44], [w * 0.86, h * 0.05], [w, -h * 0.42], [w * 0.55, -h * 0.3], [w * 0.3, -h / 2], [0, -h * 0.42]];
  b.add(projectBox(geo.profileZY(pts, 0.005), { px: A.get('sBanner'), nx: A.get('sBanner'), all: A.get('blank') }), c, { xf: { p }, crease: 0.6 });
}

/** Stossstange mit Knochenstacheln / bumper with bone spikes */
function spikeBar(b: UvBuilder, A: AtlasLayout, y: number, z: number, w: number, n: number, len: number): void {
  b.add(softBox(w, 0.022, 0.02, 0.005), mat.gunmetal, { xf: { p: [0, y, z] }, gloss: 0.3 });
  for (let i = 0; i < n; i++) spike(b, A, [-(w / 2 - 0.03) + (i / (n - 1)) * (w - 0.06), y, z + 0.008], [0, 0, 1], 0.012, len, mat.bone);
}

/** Besatzung: Figur im Massstab CREW, Huefte auf Hoehe y (Endkoordinaten), ohne Beine / crew: figure at the scale CREW, hips at height y (final coordinates), no legs */
function crew(b: UvBuilder, A: AtlasLayout, f: FactionId, p: V3, hands: [V3, V3], seed: number, head: V3 = [0, 0, 0]): void {
  b.group({ p: [p[0], p[1] - 0.302 * CREW, p[2]], s: CREW }, () => {
    figure(b, A, f, { pelvis: [0, 0.302, 0], head, handL: hands[0], handR: hands[1], footL: [0, 0, 0], footR: [0, 0, 0], elbowPoleL: [-1, -0.4, -0.3], elbowPoleR: [1, -0.4, -0.3] }, { detail: 0, noLegs: true, seed });
  });
}

// ---------- Untergangs-Buggy / doom buggy ----------

const BUGGY_SCALE = 1.05;

/** Untergangs-Buggy; A = Schrott-Atlas / doom buggy; A = scrap atlas */
export function doomBuggy(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const S = BUGGY_SCALE, wr = 0.07, cy = wr + 0.01, by = cy + 0.015, top = by + 0.268;
  const steel = mat.gunmetal;
  b.group({ s: S }, () => {
    b.mirrorX(() => { for (const z of [-0.13, 0.14]) wheel(b, A, 0.134, wr, z, wr, 0.05, 'wheel', L.trim, hi ? 16 : 10); });
    b.add(softBox(0.2, 0.03, 0.38, 0.006), mat.rustDark, { xf: { p: [0, cy, 0] }, crease: 0.5 });
    // Haube, Wannenboden, Motordeck / hood, tub floor, engine deck
    b.add(projectBox(geo.profileZY([[0.02, 0], [0.19, 0], [0.205, 0.03], [0.13, 0.066], [0.02, 0.072]], 0.196), { py: A.get('sHood'), pz: A.get('sNose'), all: A.get('blank') }), L.hull, { xf: { p: [0, by, 0] } });
    b.add(projectBox(softBox(0.196, 0.084, 0.11, 0.008), { py: A.get('grille'), nz: A.get('sNose'), all: A.get('blank') }), L.hull, { xf: { p: [0, by + 0.042, -0.125] } });
    // Seitenbleche mit Tuerausschnitt / side plates with a door cut-out
    b.mirrorX(() => b.add(projectBox(geo.profileZY([[-0.185, 0], [0.2, 0], [0.208, 0.03], [0.14, 0.07], [0.04, 0.076], [0.022, 0.048], [-0.06, 0.048], [-0.076, 0.09], [-0.185, 0.084]], 0.013), { px: A.get('sSide'), nx: A.get('sSide'), mirrorNx: true, all: A.get('blank') }), L.hull, { xf: { p: [0.104, by, 0] } }));
    emblemDecal(b, A, f, [0, by + 0.0715, 0.078], [0, 1, 0.04], 0.052, L.hull, [0, 0, 1]);
    // Ueberrollkaefig / roll cage
    const bar = (a: V3, c: V3, r = 0.0075) => tube(b, A, a, c, r, r, steel, { seg: hi ? 7 : 5, gloss: 0.3, crease: 0 });
    b.mirrorX(() => {
      bar([0.099, by + 0.07, 0.045], [0.087, top, -0.002]);
      bar([0.099, by + 0.085, -0.16], [0.087, top, -0.108]);
      bar([0.087, top, 0.004], [0.087, top, -0.114]);
    });
    bar([-0.093, top, -0.002], [0.093, top, -0.002]);
    bar([-0.093, top, -0.108], [0.093, top, -0.108]);
    if (hi) bar([-0.087, top, -0.004], [0.087, top, -0.106], 0.006);
    roofMg(b, A, L, [0.05, top, -0.11]);
    // Stachelbuegel, Scheinwerfer, Auspuffe / spiked bar, headlights, exhausts
    spikeBar(b, A, by + 0.01, 0.215, 0.27, 5, 0.052);
    for (const s of [-1, 1]) {
      headlight(b, A, [s * 0.07, by + 0.048, 0.2], 0.014);
      exhaust(b, A, [s * 0.07, by + 0.07, -0.172], [s * 0.084, by + 0.2, -0.205], 0.011);
    }
    // Ersatzrad am Heck, Banner, Schaedel auf der Haube / spare wheel at the rear, banner, skull on the hood
    b.group({ p: [0, by + 0.056, -0.186], r: [0, HALF_PI, 0] }, () => wheel(b, A, 0, 0, 0, 0.048, 0.03, 'wheel', L.trim, hi ? 14 : 8));
    tube(b, A, [-0.093, by + 0.08, -0.17], [-0.093, top + 0.085, -0.18], 0.0045, 0.004, mat.wood, { seg: hi ? 6 : 4 });
    pennant(b, A, L.primary, [-0.093, top + 0.05, -0.176], 0.064, 0.07);
    if (hi) {
      orb(b, A, [0, by + 0.078, 0.158], 0.021, mat.bone, { cell: 'skull', seg: 12, rows: 6, sz: 1.08, gloss: 0.1 });
      b.add(softBox(0.05, 0.06, 0.022, 0.006), L.primaryDark, { xf: { p: [0.066, by + 0.11, -0.172] } });
    }
  });
  // Fahrer in der offenen Wanne, Haende am Lenkrad / driver in the open tub, hands on the wheel
  const dx = -0.036 * S, dz = -0.03 * S, dy = (by + 0.026) * S;
  crew(b, A, f, [dx, dy, dz], [[-0.05, 0.37, 0.135], [0.05, 0.37, 0.135]], 3);
  tube(b, A, [dx, dy + 0.02, dz + 0.105], [dx, dy + 0.046, dz + 0.082], 0.024, 0.024, mat.dark, { seg: hi ? 10 : 6, gloss: 0.3, crease: 0.5 });
  return b;
}

// ---------- Raketenkarren / rocket cart ----------

const CART_SCALE = 1.19;

/** Raketenkarren; A = Schrott-Atlas / rocket cart; A = scrap atlas */
export function rocketCart(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const wr = 0.06, cy = wr + 0.01, by = cy + 0.015;
  const steel = mat.gunmetal;
  b.group({ s: CART_SCALE }, () => {
    b.mirrorX(() => { for (const z of [-0.14, 0.13]) wheel(b, A, 0.128, wr, z, wr, 0.046, 'wheel', L.trim, hi ? 16 : 10); });
    b.add(softBox(0.2, 0.03, 0.4, 0.006), mat.rustDark, { xf: { p: [0, cy, 0] }, crease: 0.5 });
    // Haube und Fuehrerhaus mit Panzerschlitzen / hood and cab with armour slits
    b.add(projectBox(softBox(0.22, 0.062, 0.124, 0.012), { py: A.get('sHood'), pz: A.get('sNose'), px: A.get('sPatch'), nx: A.get('sPatch'), all: A.get('blank') }), L.hull, { xf: { p: [0, by + 0.031, 0.14] } });
    b.add(projectBox(softBox(0.224, 0.094, 0.104, 0.014), { pz: A.get('sCab'), px: A.get('sDoor'), nx: A.get('sDoor'), py: A.get('sPatch'), all: A.get('blank') }), L.hull, { xf: { p: [0, by + 0.107, 0.04] } });
    for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.1125, by + 0.088, 0.036], [s, 0, 0], 0.03, L.hull);
    // Ladeflaeche / bed
    b.add(softBox(0.22, 0.012, 0.2, 0.003), mat.rustDark, { xf: { p: [0, by + 0.006, -0.1] }, crease: 0.4 });
    b.mirrorX(() => b.add(projectBox(softBox(0.012, 0.052, 0.2, 0.003), { px: A.get('sPatch'), all: A.get('blank') }), L.hull, { xf: { p: [0.105, by + 0.026, -0.1] } }));
    b.add(projectBox(softBox(0.222, 0.052, 0.012, 0.003), { nz: A.get('sPatch'), all: A.get('blank') }), L.hull, { xf: { p: [0, by + 0.026, -0.198] } });
    // Raketengestell: gross und steil aufgerichtet, drei mal drei Raketen / rocket rack: big and raised steeply, three by three rockets
    b.add(can(A, 0.022, 0.018, 0.2, steel, { seg: hi ? 8 : 6 }), null, { xf: { p: [0, by + 0.01, -0.1] } });
    tube(b, A, [0, by + 0.02, -0.19], [0, by + 0.16, -0.18], 0.012, 0.012, steel, { seg: hi ? 7 : 5 });
    b.group({ p: [0, by + 0.23, -0.1], r: [-0.85, 0, 0] }, () => {
      b.add(softBox(0.21, 0.012, 0.32, 0.003), steel, { xf: { p: [0, -0.05, 0] }, crease: 0.5 });
      b.mirrorX(() => b.add(projectBox(softBox(0.012, 0.14, 0.32, 0.003), { px: A.get('sRack'), all: A.get('blank') }), steel, { xf: { p: [0.1, 0, 0] }, gloss: 0.2 }));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const odd = (r + c) % 2 === 1;
        b.add(loft([
          { y: 0.16, rx: 0.018, hard: true, c: odd ? mat.rust : shade(mat.rust, 1.25) }, { y: 0.148, rx: 0.021 }, { y: -0.094, rx: 0.021, hard: true, c: mat.rustDark },
          { y: -0.108, rx: 0.0215, hard: true, c: odd ? L.primary : mat.ember }, { y: -0.16, rx: 0.016 }, { y: -0.212, rx: TIP },
        ], { seg: hi ? 8 : 6, region: A.get('sRocket'), capFirst: true }), null, { xf: { p: [-0.06 + c * 0.06, -0.03 + r * 0.046, 0], r: [-HALF_PI, 0, 0] }, gloss: 0.15, crease: 0.7 });
      }
    });
    // Banner, Stossstange, Antenne, Scheinwerfer, Auspuffe / banners, bumper, antenna, lights, exhausts
    for (const s of [-1, 1]) {
      tube(b, A, [s * 0.1, by + 0.05, -0.192], [s * 0.1, by + 0.275, -0.2], 0.0045, 0.004, mat.wood, { seg: hi ? 6 : 4 });
      pennant(b, A, L.primary, [s * 0.1, by + 0.228, -0.196], 0.056, 0.09);
      headlight(b, A, [s * 0.085, by + 0.046, 0.202], 0.013);
      exhaust(b, A, [s * 0.116, by + 0.03, -0.02], [s * 0.122, by + 0.168, -0.03], 0.0085);
    }
    spikeBar(b, A, cy, 0.212, 0.24, 3, 0.042);
    antenna(b, A, [0.08, by + 0.154, 0.02], 0.15, mat.ember);
    // Ersatzrad an der linken Ladewand, Suchscheinwerfer, Plane, Kisten / spare wheel on the left bed wall, searchlight, tarp, crates
    b.group({ s: [-1, 1, 1] }, () => wheel(b, A, 0.124, by + 0.09, -0.085, 0.045, 0.026, 'wheel', L.trim, hi ? 14 : 8));
    b.add(can(A, 0.017, 0.019, 0.024, steel, { seg: hi ? 10 : 6 }), null, { xf: { p: [0.06, by + 0.164, 0.05], r: [HALF_PI - 0.3, 0, 0] } });
    b.add(can(A, 0.014, 0.014, 0.004, mat.yellow, { seg: hi ? 10 : 6 }), null, { xf: { p: [0.06, by + 0.1712, 0.0732], r: [HALF_PI - 0.3, 0, 0] }, gloss: 1, crease: 0.5 });
    b.add(loft([{ y: 0.1, rx: TIP }, { y: 0.094, rx: 0.015 }, { y: 0.05, rx: 0.019 }, { y: -0.05, rx: 0.018 }, { y: -0.094, rx: 0.015 }, { y: -0.1, rx: TIP }], { seg: hi ? 10 : 6, region: A.get('tarp'), color: mix(L.primaryDark, mat.sand, 0.18) }), null, { xf: { p: [-0.02, by + 0.171, 0.022], r: [0, 0, HALF_PI] }, crease: 0 });
    b.add(projectBox(softBox(0.052, 0.036, 0.042, 0.005), { py: A.get('crate'), nz: A.get('crate'), all: A.get('blank') }), mat.woodLight, { xf: { p: [0.07, by + 0.03, -0.172] } });
    if (hi) b.add(softBox(0.042, 0.03, 0.036, 0.005), L.primaryDark, { xf: { p: [-0.068, by + 0.027, -0.172] } });
  });
  return b;
}

// ---------- Untergangs-Raupe / doom crawler ----------

/** Massstab zur Endgroesse; quer breiter wie UNIT_SHAPE des bisherigen Modells / scale to final size; wider across as UNIT_SHAPE of the previous model */
const CRAWLER_K = 1.117;
const CRAWLER_X = 1.1 * CRAWLER_K;
const CRAWLER_TRACK: TrackSpec = { x: 0.15, w: 0.1, len: 0.4, h: 0.11, links: 24, thick: 0.014 };

/** Untergangs-Raupe; A = Schrott-Atlas / doom crawler; A = scrap atlas */
export function doomCrawler(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const steel = mat.gunmetal;
  const bz = 0.2, tz = -0.07, ty = 0.193, roof = 0.276, cabZ = 0.075;
  b.group({ s: [CRAWLER_X, CRAWLER_K, CRAWLER_K] }, () => {
    b.mirrorX(() => runningGear(b, A, CRAWLER_TRACK, { wheels: 3, wheelR: 0.042, wheelColor: mat.rustDark, sprocketColor: L.trim, idlerColor: mat.rust, bayColor: mat.dark, rollers: 0 }));
    b.add(softBox(0.2, 0.07, 0.36, 0.008), mat.dark, { xf: { p: [0, 0.062, -0.02] }, crease: 0 });
    // Kettenabdeckung, Rumpf, Schuerzen / track cover, hull, skirts
    b.add(softBox(0.4, 0.018, 0.4, 0.005), mat.rustDark, { xf: { p: [0, 0.121, -0.02] } });
    b.add(projectBox(softBox(0.24, 0.066, 0.38, 0.014), { px: A.get('sSide'), nx: A.get('sSide'), py: A.get('sDeck'), pz: A.get('sNose'), nz: A.get('sNose'), all: A.get('blank') }), L.hull, { xf: { p: [0, 0.16, -0.02] } });
    b.mirrorX(() => b.add(projectBox(softBox(0.02, 0.06, 0.36, 0.005), { px: A.get('sSide'), all: A.get('blank') }), L.hull, { xf: { p: [0.2, 0.094, -0.02] } }));
    // riesige Stachelschaufel / giant spiked blade
    b.add(projectBox(geo.profileZY([[0, 0], [0.035, 0], [0.05, 0.05], [0.04, 0.13], [0.02, 0.17], [0, 0.16], [0.018, 0.12], [0.025, 0.05]], 0.44), { pz: A.get('sBlade'), all: A.get('blank') }), mat.rustDark, { xf: { p: [0, 0.005, bz] } });
    b.add(softBox(0.44, 0.012, 0.03, 0.003), mat.bone, { xf: { p: [0, 0.008, bz + 0.036] }, crease: 0.5 });
    for (let i = 0; i < 7; i++) spike(b, A, [-0.18 + i * 0.06, 0.088 + (i % 2) * 0.032, bz + 0.04], [0, 0.05, 1], 0.016, 0.072, mat.bone);
    b.mirrorX(() => b.add(softBox(0.03, 0.03, 0.13, 0.006), steel, { xf: { p: [0.11, 0.1, bz - 0.04], r: [0.3, 0, 0] }, gloss: 0.2 }));
    emblemDecal(b, A, f, [0, 0.094, bz + 0.0468], [0, 0.12, 1], 0.07, mat.rustDark);
    if (hi) for (const x of [-0.14, 0.14]) orb(b, A, [x, 0.118, bz + 0.05], 0.019, mat.bone, { cell: 'skull', seg: 12, rows: 6, sz: 1.08, gloss: 0.1 });
    // Fuehrerhaus mit Glutschlitz und Luk (breiter als bisher: der Kommandant steht im Luk)
    // cab with ember slit and hatch (wider than before: the commander stands in the hatch)
    b.add(projectBox(softBox(0.176, 0.084, 0.124, 0.014), { pz: A.get('sCab'), px: A.get('sDoor'), nx: A.get('sDoor'), py: A.get('sPatch'), all: A.get('blank') }), L.hull, { xf: { p: [0, roof - 0.042, cabZ] } });
    b.add(can(A, 0.04, 0.036, 0.012, L.hullDark, { seg: hi ? 14 : 8 }), null, { xf: { p: [0.028, roof - 0.001, cabZ - 0.004] } });
    roofMg(b, A, L, [-0.052, roof, cabZ + 0.012]);
    for (const s of [-1, 1]) headlight(b, A, [s * 0.066, 0.212, cabZ + 0.066], 0.013);
    // Glockenturm: vier Pfosten, Blechdach, Glocke / bell tower: four posts, sheet roof, bell
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(softBox(0.013, 0.142, 0.013, 0.003), mat.wood, { xf: { p: [sx * 0.045, ty + 0.071, tz + sz * 0.045] }, crease: 0.6 });
    b.add(loft([{ y: 0.072, rx: TIP, c: L.primaryDark }, { y: 0.004, rx: 0.088, hard: true }, { y: 0, rx: 0.082 }], { seg: 4, region: A.get('sRoof'), capLast: true }), null, { xf: { p: [0, ty + 0.14, tz], r: [0, Math.PI / 4, 0] } });
    b.add(loft([
      { y: 0.052, rx: 0.007, c: mat.gold }, { y: 0.047, rx: 0.017 }, { y: 0.03, rx: 0.023 }, { y: 0.012, rx: 0.026 }, { y: 0.004, rx: 0.032, hard: true },
      { y: 0, rx: 0.033, hard: true, c: shade(mat.gold, 0.6) }, { y: 0.006, rx: 0.026 },
    ], { seg: hi ? 12 : 7, region: A.get('sBell'), arc: true, capFirst: true, capLast: true }), null, { xf: { p: [0, ty + 0.086, tz] }, gloss: 0.6 });
    // Mast mit Untergangsbanner / mast with the doom banner
    tube(b, A, [0, ty + 0.2, tz], [0, ty + 0.357, tz], 0.0055, 0.0048, mat.wood, { seg: hi ? 6 : 4 });
    b.add(softBox(0.112, 0.008, 0.008, 0.002), mat.wood, { xf: { p: [0.05, ty + 0.348, tz] }, crease: 0.5 });
    b.add(projectBox(geo.profileXY([[-0.05, 0.06], [0.05, 0.06], [0.05, -0.05], [0.03, -0.034], [0.012, -0.06], [-0.012, -0.04], [-0.03, -0.06], [-0.05, -0.044]], 0.005), { pz: A.get('sBanner'), nz: A.get('sBanner'), all: A.get('blank') }), L.primary, { xf: { p: [0.055, ty + 0.284, tz] }, crease: 0.6 });
    for (const s of [-1, 1]) emblemDecal(b, A, f, [0.055, ty + 0.292, tz + s * 0.0026], [0, 0, s], 0.05, L.primary);
    // Schlote mit Glut und Rauch / smoke stacks with ember and smoke
    for (const sx of [-1, 1]) {
      b.add(loft([{ y: 0.166, rx: 0.015, hard: true, c: mat.ember }, { y: 0.162, rx: 0.0225, hard: true }, { y: 0.15, rx: 0.0225, hard: true, c: mat.rust }, { y: 0, rx: 0.026 }], { seg: hi ? 10 : 6, region: A.get('exhaust'), capFirst: true }), null, { xf: { p: [sx * 0.08, 0.19, -0.172] }, gloss: 0.1 });
      if (hi) {
        orb(b, A, [sx * 0.08, 0.392, -0.182], 0.03, mat.cloudShade, { seg: 8, rows: 4, gloss: 0 });
        orb(b, A, [sx * 0.09, 0.434, -0.2], 0.021, mix(mat.cloudShade, mat.ink, 0.3), { seg: 7, rows: 4, gloss: 0 });
      }
    }
  });
  // Kommandant im Luk des Fuehrerhauses / commander in the cab hatch
  crew(b, A, f, [0.028 * CRAWLER_X, roof * CRAWLER_K + 0.014, (cabZ - 0.004) * CRAWLER_K], [[-0.094, 0.385, 0.06], [0.092, 0.385, 0.06]], 9, [0.05, -0.3, 0]);
  return b;
}
