/**
 * Gezeichnete Einheiten: Kettenfahrzeuge der NEXUS (Railgun-Plattform, Flammenwerferpanzer).
 * Inked units: tracked machines of NEXUS (railgun platform, flamethrower tank).
 *
 * Beide stehen auf derselben Wanne: ein verjuengter Koerper mit gezeichnetem Deck, Flanken und Bug, darunter das
 * Laufwerk aus dem Fahrzeug-Baukasten. Kennformen bleiben modelliert: bei der Railgun die langen Schienen mit den
 * Leuchtspulen und die Kondensatoren, beim Flammenpanzer die zwei hohen Brennstofftanks und die breite Duese.
 * Both stand on the same hull: one tapered body with drawn deck, flanks and bow, the running gear of the vehicle kit
 * below. The marks of identity stay modelled: the railgun's long rails with the glowing coils and the capacitors, the
 * flame tank's two tall fuel tanks and the wide nozzle.
 */
import type { FactionId } from '../../../data/balance';
import { fine, shade, softBox, taperSoft, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { antenna, can, HALF_PI, hose, orb, TIP, tube } from './robotKit';
import { emblemDecal, runningGear, type TrackSpec } from './trim';
import { AtlasLayout, loft, projectBox, UvBuilder, type Ring } from './uvkit';

interface HullSpec {
  track: TrackSpec;
  wheelR: number;
  /** Breite, Hoehe, Laenge der Oberwanne, Mitte y und z / width, height, length of the upper hull, centre y and z */
  w: number; h: number; len: number; y: number; z: number;
}

/** Wanne samt Laufwerk; gibt die Deckhoehe zurueck / hull with running gear; returns the deck height */
function chassis(b: UvBuilder, A: AtlasLayout, L: Look, f: FactionId, S: HullSpec): number {
  const metal = mat.gunmetal;
  b.mirrorX(() => runningGear(b, A, S.track, { wheels: 5, wheelR: S.wheelR, wheelColor: metal, sprocketColor: L.primary, idlerColor: metal, bayColor: mat.dark, rollers: 0 }));
  // Unterwanne zwischen den Ketten / lower hull between the tracks
  b.add(softBox(S.track.x * 2 - S.track.w + 0.02, S.track.h * 0.62, S.track.len * 0.9, 0.008), mat.dark, { xf: { p: [0, S.track.h * 0.56, 0] }, crease: 0 });
  // Oberwanne: Deck, Flanken, Bug und Heck gezeichnet / upper hull: deck, flanks, bow and stern drawn
  const kx = 0.8, kz = 0.84;
  b.add(projectBox(taperSoft(softBox(S.w, S.h, S.len, 0.012), S.h, kx, kz), { py: A.get('rDeck'), px: A.get('rSide'), nx: A.get('rSide'), pz: A.get('rNose'), nz: A.get('rNose'), all: A.get('blank') }), L.hull, { xf: { p: [0, S.y, S.z] } });
  const top = S.y + S.h / 2;
  // Emblem auf beiden schraegen Flanken / emblem on both sloped flanks
  for (const s of [-1, 1]) {
    const nx = S.h, ny = (S.w * (1 - kx)) / 2;
    emblemDecal(b, A, f, [s * S.w * (1 + kx) / 4, S.y, S.z - S.len * 0.33], [s * nx, ny, 0], S.h * 0.56, L.hull, [-s * ny, nx, 0]);
  }
  return top;
}

/** Aufbau: kantiger Loft mit gezeichneter Wand und Dach, dunkler Sockel; Ringe von oben nach unten / superstructure: boxy loft with drawn wall and roof, dark base; rings top to bottom */
function housing(b: UvBuilder, A: AtlasLayout, L: Look, p: V3, rx: number, rz: number, h: number, neck: number): void {
  const hi = fine();
  const wall: Ring[] = [
    { y: h, rx: rx * 0.82, rz: rz * 0.8, e: 4, hard: true },
    { y: h - 0.008, rx: rx * 0.94, rz: rz * 0.93, e: 4 },
    { y: neck + 0.006, rx, rz, e: 4 },
    { y: neck, rx: rx * 0.96, rz: rz * 0.96, e: 4, hard: true },
  ];
  b.add(loft(wall, { seg: hi ? 16 : 8, region: A.get('rTurret'), capFirst: A.get('rTop'), capLast: true, color: L.hull }), null, { xf: { p } });
  b.add(loft([{ y: neck, rx: rx * 0.8, rz: rz * 0.8, e: 3, hard: true }, { y: 0, rx: rx * 0.86, rz: rz * 0.86, e: 3 }], { seg: hi ? 16 : 8, region: A.get('blank'), color: mat.gunmetal }), null, { xf: { p }, gloss: 0.3 });
}

/** Sensorkopf auf einem Mast / sensor head on a mast */
function sensorMast(b: UvBuilder, A: AtlasLayout, L: Look, p: V3, h: number): void {
  tube(b, A, p, [p[0], p[1] + h, p[2] - 0.008], 0.005, 0.0045, mat.gunmetal, { seg: fine() ? 6 : 4 });
  b.add(projectBox(softBox(0.042, 0.027, 0.032, 0.007), { pz: A.get('rEye'), all: A.get('blank') }), mat.gunmetal, { xf: { p: [p[0], p[1] + h + 0.01, p[2] - 0.008] }, gloss: 0.3 });
}

// ---------- Railgun-Plattform / railgun platform ----------

const RAIL_TRACK: TrackSpec = { x: 0.132, w: 0.084, len: 0.39, h: 0.082, links: 34, thick: 0.01 };

/** Railgun-Plattform; A = Roboter-Atlas / railgun platform; A = robot atlas */
export function railgun(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const metal = mat.gunmetal, glow = mat.cyanGlow;
  const top = chassis(b, A, L, f, { track: RAIL_TRACK, wheelR: 0.026, w: 0.356, h: 0.062, len: 0.4, y: 0.109, z: -0.005 });
  const tz = -0.05;
  housing(b, A, L, [0, top, tz], 0.088, 0.084, 0.086, 0.022);
  // Kondensatorbaenke mit Leuchtzellen / capacitor banks with glowing cells
  b.mirrorX(() => {
    b.add(projectBox(softBox(0.042, 0.052, 0.11, 0.008), { px: A.get('rCap'), all: A.get('blank') }), metal, { xf: { p: [0.106, top + 0.056, tz - 0.01] }, gloss: 0.3 });
    for (let i = 0; i < 3; i++) b.add(can(A, 0.0095, 0.0095, 0.02, glow, { seg: hi ? 8 : 5, cell: 'glowStrip' }), null, { xf: { p: [0.106, top + 0.082, tz - 0.042 + i * 0.032] }, crease: 0.6 });
  });
  // Schienen, Traeger, Leuchtspulen / rails, spine, glowing coils
  const gy = top + 0.062, z0 = tz + 0.06, z1 = 0.435, zm = (z0 + z1) / 2, len = z1 - z0;
  b.add(softBox(0.08, 0.056, 0.06, 0.012), metal, { xf: { p: [0, gy, tz + 0.085] }, gloss: 0.3 });
  b.mirrorX(() => b.add(projectBox(softBox(0.014, 0.036, len, 0.004), { all: A.get('rRail') }), metal, { xf: { p: [0.021, gy, zm] }, gloss: 0.5, crease: 0.6 }));
  b.add(softBox(0.03, 0.012, len, 0.003), mat.dark, { xf: { p: [0, gy - 0.016, zm] }, crease: 0 });
  const coils = hi ? 6 : 4;
  for (let i = 0; i < coils; i++) {
    const z = z0 + 0.05 + (i / (coils - 1)) * (len - 0.085);
    b.add(loft([{ y: 0.0065, rx: 0.036, e: 6, hard: true }, { y: -0.0065, rx: 0.036, e: 6, hard: true }], { seg: 8, region: A.get('glowStrip'), capFirst: true, capLast: true, color: glow }), null, { xf: { p: [0, gy, z], r: [HALF_PI, 0, 0] } });
  }
  orb(b, A, [0, gy, z1 + 0.004], 0.012, glow, { seg: hi ? 8 : 5, rows: hi ? 4 : 3, gloss: 0.8 });
  // Sensormast, Antenne / sensor mast, antenna
  sensorMast(b, A, L, [0.05, top + 0.084, tz - 0.05], 0.075);
  antenna(b, A, [-0.055, top + 0.084, tz - 0.05], 0.14, glow);
  emblemDecal(b, A, f, [0.095, top + 0.0005, 0.118], [0, 1, 0], 0.04, L.hull, [0, 0, 1]);
  return b;
}

// ---------- Flammenwerferpanzer / flamethrower tank ----------

const FLAME_TRACK: TrackSpec = { x: 0.136, w: 0.086, len: 0.4, h: 0.086, links: 34, thick: 0.01 };
/** Massstab zur Endgroesse (wie UNIT_SIZE des bisherigen Modells) / scale to final size (as UNIT_SIZE of the previous model) */
const FLAME_SCALE = 1.15;

/** Brennstofftank: Kuppel, Wand, Fuss; t laeuft linear von oben nach unten / fuel tank: dome, wall, foot; t runs linearly top to bottom */
function fuelTank(b: UvBuilder, A: AtlasLayout, L: Look, x: number, y0: number, z: number): void {
  const hi = fine(), r = 0.058;
  b.add(loft([
    { y: 0.303, rx: TIP }, { y: 0.297, rx: r * 0.42 }, { y: 0.28, rx: r * 0.78 }, { y: 0.255, rx: r * 0.97 }, { y: 0.24, rx: r },
    { y: 0.02, rx: r, hard: true }, { y: 0, rx: r * 0.7 },
  ], { seg: hi ? 16 : 10, region: A.get('rTank'), color: L.primary, capLast: true }), null, { xf: { p: [x, y0, z] }, gloss: 0.35 });
  // Ventil / valve
  b.add(can(A, 0.014, 0.012, 0.02, mat.gunmetal, { seg: hi ? 8 : 5 }), null, { xf: { p: [x, y0 + 0.3, z] } });
}

/** Flammenwerferpanzer; A = Roboter-Atlas / flamethrower tank; A = robot atlas */
export function flameTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const metal = mat.gunmetal, glow = mat.cyanGlow;
  b.group({ s: FLAME_SCALE }, () => {
    const top = chassis(b, A, L, f, { track: FLAME_TRACK, wheelR: 0.028, w: 0.36, h: 0.07, len: 0.42, y: 0.119, z: 0 });
    // zwei hohe Brennstofftanks auf dem Heck / two tall fuel tanks on the rear deck
    for (const s of [-1, 1]) {
      fuelTank(b, A, L, s * 0.074, top - 0.002, -0.115);
      // Schlauch vom Tank zum Turmkranz / hose from the tank to the turret ring
      hose(b, A, [[s * 0.074, top + 0.17, -0.062], [s * 0.066, top + 0.12, -0.035], [s * 0.045, top + 0.05, -0.012], [s * 0.035, top + 0.018, 0.0]], 0.0085, mat.dark);
    }
    b.add(softBox(0.2, 0.022, 0.05, 0.006), metal, { xf: { p: [0, top + 0.01, -0.115] } });
    // gedrungener Drehturm vorn / squat rotating turret at the front
    const tz = 0.055;
    b.turret([0, top, tz], () => {
      housing(b, A, L, [0, top, tz], 0.082, 0.078, 0.096, 0.024);
      // Flammenwerfer: Rohr mit Kuehlrippen, breite Duese, Zuendflamme / flamethrower: finned barrel, wide nozzle, pilot flame
      const gy = top + 0.052, bz = tz + 0.07;
      const fins: Ring[] = [];
      for (let i = 0; i < (hi ? 4 : 2); i++) {
        const y = -0.03 - i * (hi ? 0.024 : 0.048);
        fins.push({ y, rx: 0.026, hard: true }, { y, rx: 0.034, hard: true }, { y: y - 0.008, rx: 0.034, hard: true }, { y: y - 0.008, rx: 0.026, hard: true });
      }
      b.add(loft([
        { y: 0, rx: 0.03, hard: true, c: metal }, ...fins, { y: -0.135, rx: 0.026, hard: true, c: mat.dark },
        { y: -0.16, rx: 0.03 }, { y: -0.2, rx: 0.046, hard: true }, { y: -0.2, rx: 0.036, hard: true, c: mat.ink }, { y: -0.17, rx: 0.024 },
      ], { seg: hi ? 14 : 8, region: A.get('blank'), arc: true, capLast: true }), null, { xf: { p: [0, gy, bz], r: [-HALF_PI, 0, 0] }, gloss: 0.5 });
      b.add(softBox(0.086, 0.06, 0.05, 0.014), metal, { xf: { p: [0, gy, bz - 0.005] }, gloss: 0.3 });
      // Zuendflamme unter der Duese / pilot flame below the nozzle
      tube(b, A, [0.012, gy - 0.03, bz + 0.1], [0.004, gy - 0.036, bz + 0.185], 0.0045, 0.004, mat.yellow, { seg: hi ? 6 : 4 });
      orb(b, A, [0, gy - 0.038, bz + 0.2], 0.016, mat.orange, { sy: 1.25, gloss: 0 });
      if (hi) orb(b, A, [0, gy - 0.034, bz + 0.212], 0.009, mat.yellow, { seg: 6, rows: 4, gloss: 0 });
      // Sensorkopf, Antenne / sensor head, antenna
      b.add(projectBox(softBox(0.042, 0.027, 0.032, 0.007), { pz: A.get('rEye'), all: A.get('blank') }), metal, { xf: { p: [-0.045, top + 0.108, tz - 0.01] }, gloss: 0.3 });
      antenna(b, A, [0.048, top + 0.094, tz - 0.035], 0.12, glow);
    });
    emblemDecal(b, A, f, [0.11, top + 0.0005, 0.135], [0, 1, 0], 0.036, L.hull, [0, 0, 1]);
    // Scheinwerferleiste am Bug / light bar at the bow
    if (hi) b.add(softBox(0.12, 0.008, 0.008, 0.002), shade(glow, 1.2), { xf: { p: [0, top - 0.012, 0.19] }, crease: 0 });
  });
  return b;
}
