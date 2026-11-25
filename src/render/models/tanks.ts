/**
 * Panzer: eigene Bauform je Fraktion / tanks: own design per faction.
 * - Korvat: kastenfoermige, genietete Wanne, breite Ketten, gegossener Turm mit ZWEI Rohren, Fasser hinten
 *   / boxy riveted hull, wide tracks, cast turret with TWO barrels, fuel drums at the rear
 * - Dravon: lange Keilwanne, Keilturm weit hinten, ueberlanges Geschuetz mit grosser Muendungsbremse, Schuerzen mit Goldkante
 *   / long wedge hull, wedge turret set far back, very long gun with big muzzle brake, skirts with gold edge
 * - Alvenia: flache, abgerundete Wanne, glatter Turm mit Panzermodulen, Nebelwerfer, Rundblickperiskop, weisse Streifen
 *   / low rounded hull, smooth turret with armour modules, smoke dischargers, panoramic sight, white stripes
 * - Meridon: leicht und schmal, Container-Zusatzpanzerung, Gepaeckgestell mit Kisten, kurzes Rohr, Warnstreifen
 *   / light and narrow, container add-on armour, cargo rack with crates, short gun, hazard stripes
 * - Velkar: kompakt, Sechseck-Panzerplatten, geschlossene Kettenschuerzen, unbemannter Turm mit Sensormast
 *   / compact, hexagonal armour plates, enclosed track skirts, unmanned turret with sensor mast
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import {
  MUD, ammoBox, antennaBase, boltRing, grabRail, grille, headlight, idlerWheel, jerryCan, mantletBolts, mudBand, muffler,
  periscope, returnRoller, richBarrel, rivets, roadWheel, roundHatch, seam, smokeRack, spareLinks, sprocketWheel, squareHatch,
  tarpRoll, toolSet, towCable, towHook,
} from './detailVehicles';
import { Builder, fine, geo, shade, unitLow, type ColorLike, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { soldier, standPose } from './soldiers';

const HALF_PI = Math.PI / 2;

interface TrackOpts {
  x: number;
  w: number;
  len: number;
  h: number;
  wheels: number;
  wr: number;
  sprocket: ColorLike;
  hub: ColorLike;
  lite: boolean;
  links?: number;
  rollers?: number;
  /**
   * Reiches Laufwerk bei hoher Qualitaet (Detailrunde 4): Laufraeder mit Bandage und Radscheibe, Treibrad mit Zahnkraenzen,
   * Speichen-Leitrad, Stuetzrollen mit Halter, Kettenverbinder. Nur fuer die Fahrzeuggruppe gesetzt; andere Aufrufer
   * bleiben unveraendert. / Rich running gear on high quality (detail round 4): road wheels with tyre and disc, sprocket
   * with toothed rings, spoked idler, return rollers with brackets, track connectors. Set by the vehicle group only; other
   * callers stay unchanged.
   */
  rich?: boolean;
}

/** Kettenlauf beidseitig / track run on both sides */
export function tracks(b: Builder, o: TrackOpts) {
  const hl = o.len / 2;
  const h = o.h;
  // Kettenlauf mit runden Enden (die Kettenglieder liegen auf demselben Bogen) / track run with round ends (the track plates sit on the same arc)
  const prof: [number, number][] = [];
  const steps = o.lite ? 2 : fine() ? 5 : 3;
  const rich = !!o.rich && !o.lite && fine();
  for (const sign of [1, -1]) for (let k = 0; k <= steps; k++) {
    const a = sign * (-HALF_PI + (k / steps) * Math.PI);
    prof.push([sign * (hl - 0.035 + Math.cos(a) * h * 0.45), h * 0.5 + Math.sin(a) * h * 0.5]);
  }
  for (const s of [-1, 1]) {
    b.add(geo.profileZY(prof, o.w), mat.dark, { p: [s * o.x, 0, 0] });
    const ox = s * (o.x + o.w / 2 + 0.004);
    const span = o.len - 0.11;
    const sr = h * 0.28;
    if (rich) {
      richRunningGear(b, o, s, ox, span, sr);
      continue;
    }
    for (let i = 0; i < o.wheels; i++) {
      const z = -span / 2 + (i / (o.wheels - 1)) * span;
      b.cyl(o.wr, o.wr, 0.012, o.lite ? 8 : 12, mat.metal, [ox, o.wr + 0.004, z], [0, 0, HALF_PI]);
      if (!o.lite) b.cyl(o.wr * 0.42, o.wr * 0.42, 0.018, 6, o.hub, [ox, o.wr + 0.004, z], [0, 0, HALF_PI]);
    }
    b.cyl(sr, sr, 0.014, o.lite ? 8 : 10, o.sprocket, [ox, h * 0.62, hl - 0.024], [0, 0, HALF_PI]);
    b.cyl(sr * 0.9, sr * 0.9, 0.014, o.lite ? 8 : 10, mat.metal, [ox, h * 0.58, -hl + 0.024], [0, 0, HALF_PI]);
    if (o.lite) continue;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.box(0.008, 0.01, 0.008, mat.ink, [ox + s * 0.004, h * 0.62 + Math.cos(a) * sr, hl - 0.024 + Math.sin(a) * sr]);
    }
    const rollers = o.rollers ?? 3;
    for (let i = 0; i < rollers; i++) {
      const z = -span * 0.3 + (i / Math.max(1, rollers - 1)) * span * 0.6;
      b.cyl(0.01, 0.01, 0.012, 6, mat.metal, [ox, h * 0.86, z], [0, 0, HALF_PI]);
    }
    // einzelne Kettenglieder oben, unten und an den Enden; Einheiten in niedriger Qualitaet mit halb so vielen (spart rund
    // 500 Dreiecke je Kettenfahrzeug fuer die Kennteile der Lesbarkeit) / individual track plates top, bottom and ends; units
    // on low quality get about half as many (saves about 500 triangles per tracked vehicle for the readability parts)
    const n = Math.round((o.links ?? 10) * (unitLow() ? 1 : 1.8));
    for (let i = 0; i < n; i++) {
      const z = -hl + 0.04 + (i / (n - 1)) * (o.len - 0.08);
      b.box(o.w + 0.006, 0.007, 0.012, mat.ink, [s * o.x, h + 0.002, z]);
      b.box(o.w + 0.004, 0.006, 0.012, mat.ink, [s * o.x, -0.001, z]);
      b.box(0.008, 0.01, 0.006, mat.metal, [s * o.x, h + 0.006, z]);
    }
    for (const [zc, yc, rr] of [[hl - 0.035, h * 0.5, h * 0.5], [-hl + 0.035, h * 0.5, h * 0.5]] as [number, number, number][]) {
      const sign = zc > 0 ? 1 : -1;
      for (let k = 1; k < 6; k++) {
        const a = -HALF_PI + (k / 6) * Math.PI;
        b.box(o.w + 0.005, 0.012, 0.007, mat.ink, [s * o.x, yc + Math.sin(a) * rr, zc + sign * Math.cos(a) * rr * 0.9], [-sign * a, 0, 0]);
      }
    }
    // Radnaben-Bolzen / road wheel hub bolts
    for (let i = 0; i < o.wheels; i++) {
      const z = -span / 2 + (i / (o.wheels - 1)) * span;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        b.box(0.006, 0.005, 0.005, mat.dark, [ox + s * 0.01, o.wr + 0.004 + Math.cos(a) * o.wr * 0.65, z + Math.sin(a) * o.wr * 0.65]);
      }
    }
  }
}

/**
 * Reiches Laufwerk einer Seite (nur hohe Qualitaet): Laufraeder, Treibrad vorn, Leitrad hinten, Stuetzrollen, Kettenglieder
 * mit Fuehrungszahn und Verbindern, Gliedfugen an der Aussenseite, Bogenglieder an den Enden.
 * Rich running gear of one side (high quality only): road wheels, sprocket at the front, idler at the rear, return rollers,
 * track links with guide horn and connectors, link joints on the outer face, curved links at the ends.
 */
function richRunningGear(b: Builder, o: TrackOpts, s: number, ox: number, span: number, sr: number) {
  const h = o.h, hl = o.len / 2;
  for (let i = 0; i < o.wheels; i++) {
    const z = -span / 2 + (i / (o.wheels - 1)) * span;
    roadWheel(b, ox, o.wr + 0.004, z, o.wr, 0.016, s, mat.metal, o.hub);
  }
  sprocketWheel(b, ox, h * 0.62, hl - 0.024, sr * 1.05, 0.02, s, o.sprocket, o.hub);
  idlerWheel(b, ox, h * 0.58, -hl + 0.024, sr * 0.92, 0.018, s, mat.metal, o.hub);
  const rollers = o.rollers ?? 3;
  for (let i = 0; i < rollers; i++) {
    const z = -span * 0.3 + (i / Math.max(1, rollers - 1)) * span * 0.6;
    returnRoller(b, ox, h * 0.86, z, 0.011, 0.012, s, mat.metal, o.hub);
  }
  // Kettenglieder: Stollen, Fuehrungszahn, Verbinder an beiden Kanten / track links: grouser, guide horn, connectors at both edges
  const n = Math.round((o.links ?? 10) * 1.8);
  for (let i = 0; i < n; i++) {
    const z = -hl + 0.04 + (i / (n - 1)) * (o.len - 0.08);
    b.box(o.w + 0.006, 0.007, 0.012, mat.ink, [s * o.x, h + 0.002, z]);
    b.box(o.w + 0.004, 0.006, 0.012, mat.ink, [s * o.x, -0.001, z]);
    b.box(0.008, 0.01, 0.006, mat.metal, [s * o.x, h + 0.006, z]);
    for (const e of [-1, 1]) b.box(0.006, 0.005, 0.008, mat.darkMid, [s * o.x + e * (o.w / 2 - 0.004), h + 0.006, z]);
  }
  for (const [zc, yc, rr] of [[hl - 0.035, h * 0.5, h * 0.5], [-hl + 0.035, h * 0.5, h * 0.5]] as [number, number, number][]) {
    const sign = zc > 0 ? 1 : -1;
    for (let k = 1; k < 8; k++) {
      const a = -HALF_PI + (k / 8) * Math.PI;
      b.box(o.w + 0.005, 0.012, 0.0065, mat.ink, [s * o.x, yc + Math.sin(a) * rr, zc + sign * Math.cos(a) * rr * 0.9], [-sign * a, 0, 0]);
    }
  }
}

interface GunOpts {
  brake?: 'box' | 'ring' | 'big' | 'none'; sleeves?: number; lite: boolean; seg?: number;
  /** reiches Rohr bei hoher Qualitaet (nur Fahrzeuggruppe) / rich barrel on high quality (vehicle group only) */
  rich?: boolean;
}
/** Kanonenrohr entlang +z / gun barrel along +z */
export function gun(b: Builder, x: number, y: number, z0: number, len0: number, r0: number, c: ColorLike, o: GunOpts) {
  const seg = o.lite ? 8 : (o.seg ?? 10);
  // Comic: langes, dickes Rohr bis an den Kachelrand / comic: long, thick barrel up to the tile edge
  const len = Math.max(len0, Math.min(len0 * 1.45, 0.43 - z0)), r = r0 * 1.25;
  const rich = !!o.rich && !o.lite && fine();
  if (rich) richBarrel(b, x, y, z0, len, r, c, o.sleeves ?? 0, 16);
  else {
    b.cyl(r, r * 1.12, len, seg, c, [x, y, z0 + len / 2], [HALF_PI, 0, 0]);
    if (!o.lite) for (let i = 0; i < (o.sleeves ?? 0); i++) b.cyl(r * 1.3, r * 1.3, 0.03, seg, c, [x, y, z0 + len * (0.3 + i * 0.22)], [HALF_PI, 0, 0]);
  }
  const zt = z0 + len;
  switch (o.brake ?? 'ring') {
    case 'big':
      b.add(geo.cbox(r * 3.4, r * 2.5, 0.06, r * 0.6), mat.dark, { p: [x, y, zt - 0.02] });
      if (!o.lite) for (const sx of [-1, 1]) for (const dz of [-0.035, -0.012]) b.box(0.004, r * 1.8, 0.012, mat.ink, [x + sx * r * 1.72, y, zt + dz]);
      if (rich) {
        // Prallplatten, Deckleiste und Bolzen der Muendungsbremse / baffles, top strip and bolts of the muzzle brake
        b.box(r * 3.1, 0.004, 0.05, shade(mat.dark, 1.25), [x, y + r * 1.25 + 0.001, zt - 0.02]);
        for (const sx of [-1, 1]) for (const dz of [-0.046, -0.024, -0.001]) b.box(0.003, r * 1.2, 0.006, mat.ink, [x + sx * r * 1.72, y, zt + dz]);
        for (const sx of [-1, 1]) b.cyl(0.003, 0.003, 0.004, 6, mat.metal, [x + sx * r * 1.2, y + r * 1.25 + 0.003, zt - 0.04]);
      }
      break;
    case 'box':
      b.add(geo.cbox(r * 2.6, r * 2.2, 0.04, r * 0.5), mat.dark, { p: [x, y, zt - 0.012] });
      if (rich) for (const sx of [-1, 1]) for (const dz of [-0.02, -0.004]) b.box(0.003, r * 1.5, 0.008, mat.ink, [x + sx * r * 1.31, y, zt + dz]);
      break;
    case 'ring':
      b.cyl(r * 1.4, r * 1.4, 0.028, seg, mat.dark, [x, y, zt - 0.012], [HALF_PI, 0, 0]);
      if (rich) for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        b.box(0.004, 0.004, 0.022, mat.ink, [x + Math.sin(a) * r * 1.41, y + Math.cos(a) * r * 1.41, zt - 0.012]);
      }
      break;
    case 'none':
      break;
  }
  // Rohrmuendung / muzzle bore
  if (!o.lite) {
    const brake = o.brake ?? 'ring';
    const front = zt + (brake === 'big' ? 0.01 : brake === 'box' ? 0.008 : brake === 'ring' ? 0.002 : 0);
    b.cyl(r * 0.62, r * 0.62, 0.004, seg, mat.ink, [x, y, front], [HALF_PI, 0, 0]);
  }
}

/** Kommandant im Luk (Kopfbedeckung der Fraktion) / commander in the hatch (faction headgear) */
export function commander(b: Builder, f: FactionId, x: number, top: number, z: number, seed: number) {
  b.group({ p: [x, top - 0.13, z], s: 0.62 }, () =>
    soldier(b, f, standPose([[-0.12, 0.25, 0.04], [0.12, 0.25, 0.04]]), { detail: 0, seed, noLegs: true }),
  );
}

/** Kuppel mit offenem Lukendeckel / cupola with open hatch lid */
export function cupola(b: Builder, L: Look, x: number, y: number, z: number, r: number, lite: boolean) {
  b.cyl(r, r * 1.1, 0.024, lite ? 8 : 10, L.hullDark, [x, y + 0.012, z]);
  if (lite) return;
  if (fine()) {
    // hohe Qualitaet: Winkelspiegel rundum, Lukendeckel mit Scharnier, Griff und Polsterring, Bolzenkranz
    // high quality: periscopes all round, hatch lid with hinge, handle and seal ring, bolt ring
    for (let i = 0; i < 6; i++) {
      const a = -0.6 + (i / 6) * Math.PI * 2;
      if (Math.cos(a) < -0.75) continue;
      b.add(geo.cbox(0.014, 0.011, 0.008, 0.003), shade(L.hullDark, 0.85), { p: [x + Math.sin(a) * r * 0.98, y + 0.019, z + Math.cos(a) * r * 0.98], r: [0, a, 0] });
      b.box(0.011, 0.006, 0.002, mat.glassDark, [x + Math.sin(a) * (r * 0.98 + 0.004), y + 0.019, z + Math.cos(a) * (r * 0.98 + 0.004)], [0, a, 0]);
    }
    boltRing(b, [x, y + 0.025, z], r * 0.84, 8, mat.dark, 0.004);
    b.group({ p: [x, y + 0.045, z - r - 0.008], r: [-1.25, 0, 0] }, () => {
      b.cyl(r * 0.85, r * 0.85, 0.008, 14, L.hull, [0, 0, 0]);
      b.cyl(r * 0.7, r * 0.7, 0.003, 14, mat.darkMid, [0, -0.005, 0]);
      b.box(r * 0.8, 0.004, 0.005, mat.dark, [0, -0.007, r * 0.2]);
    });
    for (const s of [-1, 1]) b.box(0.01, 0.01, 0.012, mat.dark, [x + s * r * 0.45, y + 0.026, z - r * 0.95]);
    return;
  }
  for (const a of [0.3, 1.2, -0.6]) b.box(0.014, 0.01, 0.006, mat.glassDark, [x + Math.sin(a) * r, y + 0.018, z + Math.cos(a) * r], [0, a, 0]);
  b.add(geo.cyl(r * 0.85, r * 0.85, 0.008, 10), L.hull, { p: [x, y + 0.045, z - r - 0.008], r: [-1.25, 0, 0] });
}

export function antenna(b: Builder, x: number, y: number, z: number, h: number, tip: ColorLike, lean = -0.12) {
  b.box(0.012, 0.012, 0.012, mat.dark, [x, y + 0.006, z]);
  b.tube([x, y, z], [x, y + h, z + h * lean], 0.003, 4, mat.dark);
  b.add(geo.ico(0.008, 0), tip, { p: [x, y + h + 0.004, z + h * lean] });
}

/** Leichtes MG auf Lafette / light MG on a mount */
export function roofMg(b: Builder, L: Look, x: number, y: number, z: number, shield: ColorLike | null, rich = false) {
  if (rich && fine()) {
    // hohe Qualitaet (nur Fahrzeuggruppe): Kuehlmantel mit Loechern, Kimme und Korn, Gurtkasten mit Gurt, Schildkante
    // high quality (vehicle group only): cooling jacket with holes, rear and front sight, ammo box with belt, shield rim
    b.cyl(0.0095, 0.0095, 0.05, 10, mat.darkMid, [x, y + 0.054, z + 0.085], [HALF_PI, 0, 0]);
    for (let i = 0; i < 4; i++) b.box(0.0035, 0.0035, 0.0035, mat.ink, [x + 0.008, y + 0.056, z + 0.068 + i * 0.011]);
    b.box(0.003, 0.01, 0.003, mat.dark, [x, y + 0.068, z + 0.128]);
    b.box(0.008, 0.008, 0.003, mat.dark, [x, y + 0.068, z + 0.0]);
    for (let i = 0; i < 4; i++) b.box(0.006, 0.004, 0.008, mat.gold, [x + 0.013, y + 0.05 - i * 0.005, z + 0.006 + i * 0.002], [0, 0, 0.5]);
    b.box(0.006, 0.026, 0.006, mat.dark, [x - 0.006, y + 0.04, z - 0.04], [0.5, 0, 0]);
    if (shield) b.box(0.074, 0.004, 0.007, shade(shield, 0.75), [x, y + 0.0785, z + 0.052], [-0.1, 0, 0]);
  }
  b.cyl(0.008, 0.01, 0.04, 8, mat.dark, [x, y + 0.02, z]);
  b.add(geo.cbox(0.024, 0.03, 0.075, 0.006), mat.dark, { p: [x, y + 0.05, z + 0.01] });
  b.cyl(0.007, 0.007, 0.1, 8, mat.dark, [x, y + 0.054, z + 0.1], [HALF_PI, 0, 0]);
  b.cyl(0.011, 0.011, 0.02, 8, mat.ink, [x, y + 0.054, z + 0.145], [HALF_PI, 0, 0]);
  b.add(geo.cbox(0.026, 0.024, 0.02, 0.005), L.gear, { p: [x + 0.024, y + 0.04, z] });
  b.box(0.006, 0.02, 0.006, mat.dark, [x, y + 0.035, z - 0.03], [0.4, 0, 0]);
  if (shield) b.box(0.07, 0.045, 0.005, shield, [x, y + 0.055, z + 0.05], [-0.1, 0, 0]);
}

function sideEmblems(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, size: number, c: ColorLike = L.emblem) {
  addEmblem(b, f, size, 0.006, c, { p: [x, y, z], r: [0, HALF_PI, 0] });
  addEmblem(b, f, size, 0.006, c, { p: [-x, y, z], r: [0, -HALF_PI, 0] });
}

// ---------- Korvat ----------

function korvat(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'korvat' : L.id;
  const hi = !lite && fine();
  tracks(b, { x: 0.135, w: 0.095, len: 0.42, h: 0.095, wheels: 5, wr: 0.038, sprocket: L.trim, hub: L.hullDark, lite, links: 11, rich: true });
  // kastenfoermige Wanne mit Kettenabdeckungen / boxy hull with track guards
  b.add(geo.profileZY([[-0.2, 0.035], [0.15, 0.035], [0.215, 0.1], [0.19, 0.155], [-0.19, 0.155], [-0.21, 0.12]], 0.19), L.hull);
  b.block(0, 0.095, 0, 0.4, 0.016, 0.42, L.hull);
  b.block(0, 0.111, -0.01, 0.38, 0.044, 0.36, L.hull);
  if (!lite) {
    // Schweissnaehte + Nieten / welded seams + rivets
    for (const s of [-1, 1]) {
      b.box(0.005, 0.005, 0.36, L.hullDark, [s * 0.191, 0.155, -0.01]);
      b.box(0.005, 0.005, 0.42, L.hullDark, [s * 0.201, 0.095, 0]);
      for (let i = 0; i < 9; i++) b.box(0.006, 0.006, 0.006, L.hullDark, [s * 0.192, 0.13, -0.17 + i * 0.042]);
    }
    // Ersatzkettenglieder auf der Bugplatte / spare track links on the glacis
    b.group({ p: [0, 0.128, 0.198], r: [0.75, 0, 0] }, () => {
      for (let i = 0; i < 3; i++) {
        b.box(0.15, 0.012, 0.02, mat.dark, [0, 0, -0.025 + i * 0.026]);
        for (const x of [-0.05, 0, 0.05]) b.box(0.008, 0.016, 0.008, mat.metal, [x, 0.002, -0.025 + i * 0.026]);
      }
    });
    for (const s of [-1, 1]) {
      if (hi) headlight(b, s * 0.15, 0.124, 0.204, 0.012, L.hullDark);
      else {
        b.add(geo.cbox(0.03, 0.022, 0.02, 0.005), mat.dark, { p: [s * 0.15, 0.12, 0.2] });
        b.box(0.022, 0.016, 0.004, mat.yellow, [s * 0.15, 0.12, 0.211]);
      }
    }
    if (hi) korvatHull(b, L);
    // Fasser am Heck / fuel drums at the rear
    for (const s of [-1, 1]) {
      b.cyl(0.032, 0.032, 0.11, 10, L.trim, [s * 0.06, 0.18, -0.205], [0, 0, HALF_PI]);
      b.cyl(0.034, 0.034, 0.012, 10, L.primaryDark, [s * 0.06, 0.18, -0.205], [0, 0, HALF_PI]);
      b.cyl(0.033, 0.033, 0.006, 10, mat.dark, [s * 0.06 + s * 0.05, 0.18, -0.205], [0, 0, HALF_PI]);
    }
    b.box(0.26, 0.012, 0.012, mat.dark, [0, 0.15, -0.205]);
    // Motorgitter + Auspuff / engine grille + exhaust
    for (let i = 0; i < 4; i++) b.box(0.16, 0.006, 0.01, mat.ink, [0, 0.157, -0.1 - i * 0.022]);
    for (const s of [-1, 1]) b.cyl(0.012, 0.014, 0.05, 8, mat.darkMid, [s * 0.15, 0.17, -0.16]);
    for (const s of [-1, 1]) b.add(geo.cbox(0.05, 0.03, 0.12, 0.006), L.trim, { p: [s * 0.15, 0.17, 0.0] });
  }
  // grosser gegossener Turm / large cast turret
  const ty = 0.155, tz = -0.03;
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, ty, tz], () => {
    b.add(geo.rtaper(0.24, 0.24, 0.18, 0.17, 0.09, 0.028, 0.005), L.hull, { p: [0, ty + 0.045, tz] });
    b.add(geo.cyl(0.124, 0.124, 0.012, lite ? 10 : 16, true), L.trim, { p: [0, ty + 0.018, tz] });
    b.add(geo.rbox(0.15, 0.06, 0.05, 0.016), L.hullDark, { p: [0, ty + 0.045, tz + 0.12] });
    // ZWEI parallele Rohre / TWO parallel barrels
    for (const x of [-0.034, 0.034]) gun(b, x, ty + 0.048, tz + 0.14, 0.235, 0.015, L.hullDark, { brake: 'box', sleeves: 1, lite, rich: true });
    if (hi) korvatTurret(b, L, ty, tz);
    if (!lite) {
      b.box(0.04, 0.012, 0.03, L.hullDark, [0, ty + 0.048, tz + 0.15]);
      // Nieten am Turm + Staukorb / turret rivets + stowage basket
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.box(0.007, 0.007, 0.007, L.hullDark, [Math.sin(a) * 0.112, ty + 0.03, tz + Math.cos(a) * 0.112]);
      }
      b.add(geo.cbox(0.17, 0.035, 0.04, 0.006), L.trim, { p: [0, ty + 0.035, tz - 0.135] });
      for (const x of [-0.06, 0, 0.06]) b.box(0.006, 0.037, 0.042, mat.dark, [x, ty + 0.035, tz - 0.135]);
      cupola(b, L, -0.05, ty + 0.09, tz - 0.04, 0.036, lite);
      commander(b, f, -0.05, ty + 0.1, tz - 0.04, 7);
      b.cyl(0.025, 0.028, 0.016, 10, L.hullDark, [0.055, ty + 0.098, tz - 0.02]);
      roofMg(b, L, 0.055, ty + 0.106, tz - 0.02, L.trim, true);
      // Winkelspiegel vorn am Turm / periscopes at the turret front
      for (const x of [-0.07, 0.07]) b.add(geo.cbox(0.022, 0.016, 0.016, 0.004), mat.dark, { p: [x, ty + 0.095, tz + 0.05] });
      antenna(b, 0.075, ty + 0.09, tz - 0.1, 0.2, L.trim);
      sideEmblems(b, f, L, 0.112, ty + 0.05, tz - 0.02, 0.032);
    }
  });
}

/**
 * Korvat-Wanne, hohe Qualitaet: Fahrer- und Funkerluke, Winkelspiegel, Schweissnaehte an der Bugplatte, Abschleppoesen,
 * Schmutzfaenger, Pionierwerkzeug und Abschleppseil an der Flanke, Motorgitter mit Rahmen, Kanister, Spanngurte an den
 * Fassern, Schmutzbaender. / Korvat hull, high quality: driver and radio operator hatches, periscopes, weld seams on the
 * glacis, tow eyes, mud flaps, pioneer tools and tow cable on the flank, framed engine grille, jerry cans, straps on the
 * drums, mud bands.
 */
function korvatHull(b: Builder, L: Look) {
  const seamC = shade(L.hull, 0.72);
  // Luken und Winkelspiegel vor dem Turm / hatches and periscopes in front of the turret
  squareHatch(b, -0.105, 0.155, 0.128, 0.05, 0.04, L.hull);
  for (const x of [-0.122, -0.088]) periscope(b, x, 0.155, 0.158, 0, L.hullDark, 0.9);
  roundHatch(b, 0.105, 0.155, 0.13, 0.021, L.hull);
  periscope(b, 0.105, 0.155, 0.162, 0.2, L.hullDark, 0.9);
  // Kugelblende des Bug-MG / ball mount of the bow MG
  b.group({ p: [0.09, 0.128, 0.198], r: [0.75, 0, 0] }, () => {
    b.add(geo.hemi(0.016, 12, 4), L.hullDark, { r: [0, 0, 0] });
    b.cyl(0.004, 0.004, 0.05, 6, mat.dark, [0, 0.03, 0]);
  });
  // Schweissnaehte an Bug- und Deckkanten / weld seams on bow and deck edges
  seam(b, [-0.19, 0.155, 0.17], [0.19, 0.155, 0.17], seamC);
  seam(b, [-0.19, 0.1, 0.214], [0.19, 0.1, 0.214], seamC);
  for (const s of [-1, 1]) seam(b, [s * 0.19, 0.155, 0.17], [s * 0.19, 0.1, 0.214], seamC);
  rivets(b, [-0.17, 0.158, 0.165], [0.17, 0.158, 0.165], 12, L.hullDark, 0.0045);
  // Abschleppoesen vorn und hinten / tow eyes front and rear
  for (const s of [-1, 1]) {
    towHook(b, s * 0.06, 0.07, 0.205, 1, L.hullDark);
    towHook(b, s * 0.13, 0.085, -0.212, -1, L.hullDark);
    // Schmutzfaenger an den Kettenabdeckungen / mud flaps on the track guards
    for (const z of [0.207, -0.207]) b.box(0.085, 0.03, 0.004, mat.dark, [s * 0.14, 0.08, z]);
  }
  // Werkzeug an der rechten Flanke, Abschleppseil auf der Kettenabdeckung / tools on the right flank, tow cable on the guard
  toolSet(b, [0.193, 0.134, -0.06], [0, 0, -HALF_PI], 0.15);
  toolSet(b, [-0.193, 0.134, -0.03], [0, 0, HALF_PI], 0.13, ['bar', 'shovel']);
  towCable(b, [0.196, 0.114, -0.17], [0.196, 0.114, 0.15]);
  towCable(b, [-0.196, 0.114, -0.17], [-0.196, 0.114, 0.15]);
  // Motorgitter mit Rahmen und Wartungsdeckel / framed engine grille and service lid
  grille(b, [0, 0.154, -0.133], 0.165, 0.08, 6, L.hullDark);
  squareHatch(b, 0, 0.152, -0.19, 0.1, 0.025, L.hull);
  // Regenkappen auf den Auspuffen / rain caps on the exhausts
  for (const s of [-1, 1]) {
    b.cyl(0.016, 0.016, 0.006, 10, mat.dark, [s * 0.15, 0.198, -0.16]);
    b.add(geo.cyl(0.015, 0.015, 0.003, 10), mat.darkMid, { p: [s * 0.15, 0.203, -0.168], r: [-0.5, 0, 0] });
    // Spanngurte und Verschluss an den Fassern / straps and bung on the drums
    for (const dx of [-0.035, 0.035]) b.cyl(0.0335, 0.0335, 0.006, 14, mat.dark, [s * 0.06 + dx, 0.18, -0.205], [0, 0, HALF_PI]);
    b.cyl(0.006, 0.006, 0.006, 6, mat.metal, [s * 0.06 + s * 0.058, 0.19, -0.205], [0, 0, HALF_PI]);
    // Staukaesten mit Deckelkante und Riegel / stowage bins with lid edge and latch
    b.box(0.054, 0.005, 0.124, shade(L.trim, 0.78), [s * 0.15, 0.186, 0.0]);
    for (const z of [-0.035, 0.035]) b.box(0.006, 0.012, 0.004, mat.dark, [s * 0.176, 0.178, z]);
  }
  // Kanister hinten auf dem Deck, ausserhalb des Turmschwenks / jerry cans on the rear deck, outside the turret sweep
  jerryCan(b, [0.165, 0.155, -0.115], HALF_PI, L.primaryDark, 0.9);
  jerryCan(b, [-0.165, 0.155, -0.115], HALF_PI, L.primaryDark, 0.9);
  // Schmutzbaender an Flanken und Bug / mud bands on the flanks and bow
  mudBand(b, 11, 0.194, 0.112, 0.15, -0.18, 0.16, 12);
  for (let i = 0; i < 6; i++) b.box(0.03 + (i % 3) * 0.012, 0.004, 0.012, MUD, [-0.15 + i * 0.06, 0.06 + (i % 2) * 0.012, 0.19 + (i % 2) * 0.006], [0.75, 0, 0]);
}

/**
 * Korvat-Turm, hohe Qualitaet: Blende mit Bolzen und Zielfernrohr, Bolzenkranz am Turmring, Nebelwerfer, Haltegriffe,
 * Pistolenluken, Luefterhaube, Hebeoesen, Plane auf dem Staukorb, Gussnaehte.
 * Korvat turret, high quality: mantlet with bolts and sight, bolt ring at the turret ring, smoke dischargers, grab rails,
 * pistol ports, ventilator dome, lifting eyes, tarp on the stowage basket, casting seams.
 */
function korvatTurret(b: Builder, L: Look, ty: number, tz: number) {
  mantletBolts(b, 0, ty + 0.045, tz + 0.145, 0.15, 0.06, L.hull);
  boltRing(b, [0, ty + 0.026, tz], 0.126, 18, L.hullDark, 0.005);
  for (const s of [-1, 1]) {
    smokeRack(b, [s * 0.1, ty + 0.07, tz + 0.06], s as 1 | -1, 3, L.hullDark, s * 0.3);
    grabRail(b, s * 0.112, ty + 0.075, tz - 0.09, tz - 0.02, s * 0.008);
    // Pistolenluke / pistol port
    b.cyl(0.011, 0.011, 0.006, 10, L.hullDark, [s * 0.118, ty + 0.04, tz + 0.04], [0, 0, HALF_PI]);
    b.box(0.004, 0.004, 0.01, mat.dark, [s * 0.122, ty + 0.04, tz + 0.04]);
    // Hebeoesen / lifting eyes
    b.add(geo.torus(0.007, 0.0025, 4, 8), mat.dark, { p: [s * 0.07, ty + 0.098, tz + 0.04], r: [0, HALF_PI, 0] });
    // Gussnaht an der Turmflanke / casting seam on the turret flank
    seam(b, [s * 0.119, ty + 0.012, tz - 0.08], [s * 0.119, ty + 0.012, tz + 0.08], shade(L.hull, 0.75));
  }
  // Luefterhaube / ventilator dome
  b.add(geo.hemi(0.018, 12, 4), L.hullDark, { p: [0.0, ty + 0.09, tz - 0.075], s: [1, 0.6, 1] });
  for (let i = 0; i < 4; i++) b.box(0.003, 0.004, 0.012, mat.ink, [-0.009 + i * 0.006, ty + 0.096, tz - 0.075]);
  // Plane und Kisten im Staukorb / tarp and boxes in the stowage basket
  tarpRoll(b, [0, ty + 0.067, tz - 0.14], 0.15, 0.016, L.gear, mat.dark);
  ammoBox(b, [0.05, ty + 0.052, tz - 0.165], 0.1, L.gear, 0.8);
  antennaBase(b, 0.075, ty + 0.09, tz - 0.1);
}

// ---------- Dravon ----------

function dravon(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'dravon' : L.id;
  const gold = L.secondary;
  const hi = !lite && fine();
  tracks(b, { x: 0.13, w: 0.085, len: 0.44, h: 0.085, wheels: 6, wr: 0.03, sprocket: gold, hub: L.hullDark, lite, links: 12, rich: true });
  // lange Keilwanne / long wedge hull
  b.add(geo.profileZY([[-0.22, 0.035], [0.17, 0.035], [0.235, 0.075], [0.16, 0.135], [-0.2, 0.14], [-0.225, 0.1]], 0.2), L.hull);
  b.add(geo.prismXZ([[-0.19, -0.22], [0.19, -0.22], [0.19, 0.1], [0.12, 0.2], [-0.12, 0.2], [-0.19, 0.1]], 0.014), L.hull, { p: [0, 0.088, 0] });
  b.add(geo.prismXZ([[-0.15, -0.2], [0.15, -0.2], [0.15, 0.08], [0.08, 0.16], [-0.08, 0.16], [-0.15, 0.08]], 0.04), shade(L.hull, 0.9), { p: [0, 0.1, 0] });
  // Seitenschuerzen mit Goldkante / side skirts with gold edge
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.012, 0.055, 0.4, 0.004), L.hull, { p: [s * 0.183, 0.07, -0.01] });
    b.box(0.014, 0.007, 0.4, gold, [s * 0.183, 0.044, -0.01]);
    b.box(0.014, 0.005, 0.4, gold, [s * 0.183, 0.096, -0.01]);
    if (!lite) for (let i = 0; i < 4; i++) b.box(0.014, 0.05, 0.004, L.hullDark, [s * 0.184, 0.07, -0.16 + i * 0.1]);
  }
  if (!lite) {
    // Bugdetails, Motordeck, Auspuff / bow details, engine deck, exhaust
    b.box(0.2, 0.006, 0.006, gold, [0, 0.139, 0.16]);
    for (const s of [-1, 1]) {
      if (hi) {
        headlight(b, s * 0.11, 0.132, 0.17, 0.0095, L.hullDark);
        muffler(b, [s * 0.1, 0.152, -0.17], 0.06, 0.013, mat.darkMid);
        continue;
      }
      b.add(geo.taper(0.03, 0.014, 0.02, 0.008, 0.018), mat.dark, { p: [s * 0.11, 0.13, 0.17] });
      b.box(0.022, 0.012, 0.004, mat.yellow, [s * 0.11, 0.13, 0.177]);
      b.cyl(0.011, 0.013, 0.04, 8, mat.darkMid, [s * 0.1, 0.15, -0.19], [0.6, 0, 0]);
    }
    if (hi) dravonHull(b, L);
    else for (let i = 0; i < 5; i++) b.box(0.18, 0.006, 0.01, mat.ink, [0, 0.141, -0.04 - i * 0.026]);
  }
  // scharfer Keilturm weit hinten / sharp wedge turret set far back
  const ty = 0.14, tz = -0.08;
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, ty, tz], () => {
    b.add(geo.prismXZ([[-0.12, -0.12], [0.12, -0.12], [0.13, 0.03], [0.06, 0.15], [-0.06, 0.15], [-0.13, 0.03]], 0.072), L.hull, { p: [0, ty, tz] });
    b.add(geo.prismXZ([[-0.1, -0.1], [0.1, -0.1], [0.11, 0.02], [0.04, 0.12], [-0.04, 0.12], [-0.11, 0.02]], 0.02), shade(L.hull, 0.85), { p: [0, ty + 0.072, tz] });
    b.add(geo.prismXZ([[-0.125, -0.12], [0.125, -0.12], [0.135, 0.03], [-0.135, 0.03]], 0.008), gold, { p: [0, ty + 0.034, tz] });
    b.add(geo.prismXZ([[-0.12, -0.13], [0.12, -0.13], [0.12, -0.12], [-0.12, -0.12]], 0.05), mat.dark, { p: [0, ty + 0.01, tz] });
    // ueberlanges Geschuetz mit grosser Muendungsbremse / very long gun with big muzzle brake
    b.add(geo.cbox(0.07, 0.05, 0.05, 0.012), shade(L.hull, 0.8), { p: [0, ty + 0.036, tz + 0.16] });
    gun(b, 0, ty + 0.036, tz + 0.18, 0.33, 0.021, shade(L.hull, 0.8), { brake: 'big', sleeves: 2, lite, rich: true });
    if (hi) dravonTurret(b, L, ty, tz);
    if (!lite) {
      // Koax-MG, Dach-MG, Kommandant, Antennen, Embleme / coaxial MG, roof MG, commander, antennas, emblems
      b.cyl(0.004, 0.004, 0.08, 6, mat.dark, [0.045, ty + 0.03, tz + 0.2], [HALF_PI, 0, 0]);
      roofMg(b, L, 0.06, ty + 0.092, tz - 0.01, gold, true);
      cupola(b, L, -0.05, ty + 0.092, tz - 0.03, 0.034, lite);
      commander(b, f, -0.05, ty + 0.1, tz - 0.03, 7);
      antenna(b, 0.09, ty + 0.072, tz - 0.1, 0.18, gold);
      antenna(b, -0.09, ty + 0.072, tz - 0.1, 0.15, gold);
      sideEmblems(b, f, L, 0.127, ty + 0.05, tz - 0.04, 0.03, gold);
      b.box(0.006, 0.006, 0.12, gold, [0, ty + 0.093, tz]);
    }
  });
}

/**
 * Dravon-Wanne, hohe Qualitaet: Fahrerluke mit Winkelspiegeln, Ersatzkettenglieder auf der Bugplatte, Abschleppoesen,
 * Schuerzen mit Bolzenreihen und Schmutz, Werkzeug und Abschleppseil auf den Seitenstufen, Kanister, Motorgitter mit
 * Rahmen, Plattenfugen. / Dravon hull, high quality: driver hatch with periscopes, spare track links on the glacis, tow
 * eyes, skirts with bolt rows and mud, tools and tow cable on the side steps, jerry cans, framed engine grille, plate joints.
 */
function dravonHull(b: Builder, L: Look) {
  const gold = L.secondary, seamC = shade(L.hull, 0.7);
  squareHatch(b, -0.06, 0.14, 0.105, 0.046, 0.036, L.hull);
  for (const x of [-0.076, -0.044]) periscope(b, x, 0.14, 0.133, 0, L.hullDark, 0.85);
  spareLinks(b, [0, 0.105, 0.2], [0.675, 0, 0], 2, 0.12);
  for (const s of [-1, 1]) {
    towHook(b, s * 0.07, 0.06, 0.232, 1, L.hullDark);
    towHook(b, s * 0.12, 0.07, -0.226, -1, L.hullDark);
    // Schuerzen: Bolzen an der Oberkante / skirts: bolts along the top edge
    rivets(b, [s * 0.19, 0.088, -0.19], [s * 0.19, 0.088, 0.17], 11, L.hullDark, 0.0045);
    // Seitenstufe: Kanister hinten / side step: jerry can at the rear
    jerryCan(b, [s * 0.17, 0.102, -0.185], 0, L.hullDark, 0.85);
    // Plattenfuge der Oberwanne / plate joint of the upper hull
    seam(b, [s * 0.15, 0.141, -0.2], [s * 0.15, 0.141, 0.08], seamC);
  }
  mudBand(b, 23, 0.19, 0.045, 0.095, -0.2, 0.18, 14);
  toolSet(b, [0.17, 0.102, -0.03], [0, 0, 0], 0.17, ['shovel', 'bar']);
  toolSet(b, [-0.17, 0.102, -0.03], [0, 0, 0], 0.15, ['axe', 'bar']);
  towCable(b, [0.17, 0.106, 0.07], [0.17, 0.106, 0.15], mat.darkMid);
  towCable(b, [-0.17, 0.106, 0.07], [-0.17, 0.106, 0.15], mat.darkMid);
  grille(b, [0, 0.14, -0.095], 0.18, 0.13, 7, L.hullDark);
  b.box(0.2, 0.004, 0.004, gold, [0, 0.141, -0.025]);
  // Plattenfuge auf der Bugschraege / plate joint on the bow slope
  seam(b, [-0.12, 0.137, 0.16], [0.12, 0.137, 0.16], seamC);
}

/**
 * Dravon-Turm, hohe Qualitaet: Blendenbolzen, Nebelwerfer an den Wangen, Bolzen an der Dachplatte, Lueftungshaube,
 * Staukasten mit Plane hinten, Zielgeraet des Kommandanten, Antennenfuesse.
 * Dravon turret, high quality: mantlet bolts, smoke dischargers on the cheeks, bolts on the roof plate, ventilator,
 * rear stowage bin with tarp, commander's sight, antenna bases.
 */
function dravonTurret(b: Builder, L: Look, ty: number, tz: number) {
  const gold = L.secondary;
  mantletBolts(b, 0, ty + 0.036, tz + 0.185, 0.07, 0.05, shade(L.hull, 0.65));
  for (const s of [-1, 1]) {
    smokeRack(b, [s * 0.12, ty + 0.078, tz + 0.02], s as 1 | -1, 3, L.hullDark, s * 0.45);
    rivets(b, [s * 0.1, ty + 0.094, tz - 0.09], [s * 0.105, ty + 0.094, tz + 0.01], 5, L.hullDark, 0.0045);
    antennaBase(b, s * 0.09, ty + 0.072, tz - 0.1);
    grabRail(b, s * 0.128, ty + 0.055, tz - 0.1, tz - 0.03, s * 0.007, gold);
  }
  // Lueftungshaube und Zielgeraet / ventilator and sight
  b.add(geo.hemi(0.016, 12, 4), L.hullDark, { p: [0.0, ty + 0.092, tz + 0.06], s: [1, 0.55, 1] });
  periscope(b, -0.02, ty + 0.092, tz + 0.03, 0, L.hullDark, 1.1);
  // Staukasten mit Plane am Heck / rear stowage bin with tarp
  b.add(geo.cbox(0.2, 0.035, 0.035, 0.006), shade(L.hull, 0.85), { p: [0, ty + 0.05, tz - 0.145] });
  for (const x of [-0.07, 0, 0.07]) b.box(0.004, 0.037, 0.037, mat.dark, [x, ty + 0.05, tz - 0.145]);
  tarpRoll(b, [0, ty + 0.082, tz - 0.145], 0.16, 0.014, L.gear, gold);
}

// ---------- Alvenia ----------

function alvenia(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'alvenia' : L.id;
  const white = L.trim;
  const hi = !lite && fine();
  tracks(b, { x: 0.128, w: 0.08, len: 0.42, h: 0.08, wheels: 6, wr: 0.028, sprocket: L.hullDark, hub: white, lite, links: 11, rich: true });
  // flache, abgerundete Wanne / low rounded hull
  b.add(geo.profileZY([[-0.2, 0.035], [0.14, 0.035], [0.19, 0.055], [0.215, 0.085], [0.2, 0.11], [0.15, 0.13], [-0.19, 0.13], [-0.21, 0.1]], 0.2), L.hull);
  b.add(geo.rbox(0.37, 0.03, 0.41, 0.014), L.hull, { p: [0, 0.098, -0.005] });
  // halbhohe abgerundete Schuerzen mit weissem Streifen / half-height rounded skirts with white stripe
  for (const s of [-1, 1]) {
    b.add(geo.rbox(0.014, 0.04, 0.38, 0.006), L.hull, { p: [s * 0.18, 0.078, 0] });
    b.box(0.016, 0.008, 0.38, white, [s * 0.18, 0.084, 0]);
  }
  if (!lite) {
    b.box(0.24, 0.006, 0.008, white, [0, 0.112, 0.17]);
    for (const s of [-1, 1]) {
      if (hi) {
        headlight(b, s * 0.1, 0.112, 0.196, 0.01, L.hullDark);
        continue;
      }
      b.add(geo.cyl(0.012, 0.012, 0.012, 8), mat.dark, { p: [s * 0.1, 0.11, 0.195], r: [HALF_PI - 0.5, 0, 0] });
      b.cyl(0.009, 0.009, 0.004, 8, mat.yellow, [s * 0.1, 0.114, 0.201], [HALF_PI - 0.5, 0, 0]);
    }
    if (hi) alveniaHull(b, L);
    else for (let i = 0; i < 4; i++) b.box(0.16, 0.004, 0.012, mat.ink, [0, 0.115, -0.08 - i * 0.026]);
  }
  // glatter, flacher Turm mit Panzermodulen / smooth low turret with armour modules
  const ty = 0.13, tz = -0.02;
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, ty, tz], () => {
    b.add(geo.rtaper(0.24, 0.25, 0.17, 0.17, 0.07, 0.022, 0.012), L.hull, { p: [0, ty + 0.035, tz] });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) b.add(geo.rbox(0.03, 0.05, 0.06, 0.008), shade(L.hull, 0.9), { p: [s * 0.12, ty + 0.032, tz - 0.07 + i * 0.065], r: [0, 0, s * 0.18] });
      b.add(geo.rtaper(0.07, 0.03, 0.05, 0.02, 0.05, 0.006), shade(L.hull, 0.9), { p: [s * 0.075, ty + 0.03, tz + 0.12], r: [0.3, s * 0.2, 0] });
    }
    // weisse Streifen auf dem Turmdach / white stripes on the turret roof
    for (const x of [-0.03, 0.03]) b.box(0.016, 0.004, 0.16, white, [x, ty + 0.071, tz - 0.01]);
    b.add(geo.cbox(0.07, 0.05, 0.04, 0.012), L.hullDark, { p: [0, ty + 0.035, tz + 0.13] });
    gun(b, 0, ty + 0.035, tz + 0.15, 0.27, 0.015, L.hullDark, { brake: 'ring', sleeves: 3, lite, seg: 12, rich: true });
    if (hi) alveniaTurret(b, L, ty, tz);
    if (!lite) {
      b.cyl(0.024, 0.024, 0.05, 12, L.hullDark, [0, ty + 0.035, tz + 0.29], [HALF_PI, 0, 0]);
      // Nebelwerfer 4x2 / smoke dischargers 4x2
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        b.cyl(0.007, 0.007, 0.026, 6, mat.dark, [s * (0.085 + i * 0.011), ty + 0.07, tz + 0.085 - i * 0.012], [0.6, 0, s * 0.35]);
      }
      // Rundblickperiskop + Kommandant / panoramic sight + commander
      b.cyl(0.012, 0.014, 0.04, 10, L.hullDark, [0.055, ty + 0.09, tz - 0.03]);
      b.add(geo.rbox(0.04, 0.026, 0.034, 0.008), L.hullDark, { p: [0.055, ty + 0.122, tz - 0.03] });
      b.box(0.03, 0.012, 0.004, mat.glass, [0.055, ty + 0.124, tz - 0.012]);
      cupola(b, L, -0.05, ty + 0.07, tz - 0.04, 0.034, lite);
      roofMg(b, L, 0.05, ty + 0.07, tz - 0.03, L.trim, true);
      commander(b, f, -0.05, ty + 0.08, tz - 0.04, 7);
      antenna(b, -0.09, ty + 0.07, tz - 0.1, 0.2, white);
      b.add(geo.cbox(0.16, 0.03, 0.035, 0.008), L.hullDark, { p: [0, ty + 0.035, tz - 0.135] });
      sideEmblems(b, f, L, 0.137, ty + 0.035, tz - 0.0, 0.026, white);
    }
  });
}

/**
 * Alvenia-Wanne, hohe Qualitaet: Fahrerluke mit drei Winkelspiegeln, Schuerzen mit Fugen und Goldbolzen, Werkzeug und
 * Abschleppseil auf den Seitenborden, Stauboxen, Motorgitter, Abschleppoesen, Ruecklichter.
 * Alvenia hull, high quality: driver hatch with three periscopes, skirts with joints and gold bolts, tools and tow cable
 * on the side shelves, stowage boxes, engine grille, tow eyes, tail lights.
 */
function alveniaHull(b: Builder, L: Look) {
  const white = L.trim, seamC = shade(L.hull, 0.72);
  squareHatch(b, 0, 0.13, 0.13, 0.05, 0.03, L.hull);
  for (const [x, a] of [[-0.035, 0.3], [0, 0], [0.035, -0.3]] as [number, number][]) periscope(b, x, 0.128, 0.154, a, L.hullDark, 0.8);
  for (const s of [-1, 1]) {
    // Schuerzenfugen und Bolzen / skirt joints and bolts
    for (let i = 0; i < 4; i++) {
      const z = -0.142 + i * 0.095;
      seam(b, [s * 0.188, 0.06, z], [s * 0.188, 0.096, z], seamC);
      b.box(0.004, 0.004, 0.004, white, [s * 0.188, 0.07, z + 0.03]);
    }
    towHook(b, s * 0.07, 0.07, 0.212, 1, L.hullDark);
    towHook(b, s * 0.12, 0.07, -0.21, -1, L.hullDark);
    // Ruecklichter / tail lights
    b.box(0.016, 0.008, 0.004, mat.red, [s * 0.15, 0.1, -0.207]);
    // Staubox hinten auf dem Seitenbord / stowage box at the rear on the side shelf
    b.add(geo.cbox(0.06, 0.03, 0.08, 0.008), L.hull, { p: [s * 0.145, 0.128, -0.15] });
    b.box(0.062, 0.004, 0.006, white, [s * 0.145, 0.134, -0.11]);
    b.box(0.008, 0.01, 0.004, mat.dark, [s * 0.145, 0.124, -0.108]);
  }
  toolSet(b, [0.145, 0.113, 0.0], [0, 0, 0], 0.16, ['shovel', 'axe', 'bar']);
  towCable(b, [-0.15, 0.117, -0.08], [-0.15, 0.117, 0.14]);
  jerryCan(b, [-0.13, 0.113, 0.15], HALF_PI, L.hullDark, 0.8);
  grille(b, [0, 0.13, -0.12], 0.16, 0.1, 6, L.hullDark);
  mudBand(b, 37, 0.188, 0.06, 0.096, -0.19, 0.19, 12);
  seam(b, [-0.18, 0.1, 0.17], [0.18, 0.1, 0.17], seamC);
}

/**
 * Alvenia-Turm, hohe Qualitaet: Blendenbolzen, Bolzen an den Panzermodulen, Warnempfaenger an den Ecken, Haltegriffe,
 * Gepaeckkorb mit Plane, goldene Zierkante.
 * Alvenia turret, high quality: mantlet bolts, bolts on the armour modules, warning receivers at the corners, grab rails,
 * bustle rack with tarp, gold trim edge.
 */
function alveniaTurret(b: Builder, L: Look, ty: number, tz: number) {
  const white = L.trim;
  mantletBolts(b, 0, ty + 0.035, tz + 0.15, 0.07, 0.05, L.hull);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) b.box(0.006, 0.006, 0.006, white, [s * 0.137, ty + 0.042, tz - 0.07 + i * 0.065]);
    // Warnempfaenger / warning receivers
    b.cyl(0.008, 0.008, 0.012, 10, mat.dark, [s * 0.085, ty + 0.077, tz + 0.07]);
    b.box(0.01, 0.004, 0.003, mat.glassDark, [s * 0.085, ty + 0.078, tz + 0.078]);
    grabRail(b, s * 0.11, ty + 0.06, tz - 0.1, tz - 0.04, s * 0.008, white);
  }
  // goldene Zierkante um den Turmfuss / gold trim edge around the turret base
  b.add(geo.cyl(0.12, 0.124, 0.006, 20, true), white, { p: [0, ty + 0.004, tz] });
  // Gepaeckkorb mit Plane / bustle rack with tarp
  tarpRoll(b, [0, ty + 0.06, tz - 0.135], 0.15, 0.014, L.gear, white);
  for (const x of [-0.07, 0.07]) b.tube([x, ty + 0.05, tz - 0.115], [x, ty + 0.05, tz - 0.155], 0.0025, 4, mat.dark);
}

// ---------- Meridon ----------

function container(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, c: ColorLike, ribs: number, along: 'x' | 'z') {
  b.add(geo.cbox(w, h, d, 0.004), c, { p: [x, y, z] });
  for (let i = 0; i < ribs; i++) {
    const t = -0.5 + (i + 0.5) / ribs;
    if (along === 'z') b.box(w + 0.004, h - 0.006, 0.005, shade(c, 0.75), [x, y, z + t * d]);
    else b.box(0.005, h - 0.006, d + 0.004, shade(c, 0.75), [x + t * w, y, z]);
  }
}

function meridon(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'meridon' : L.id;
  const orange = L.trim;
  const hi = !lite && fine();
  tracks(b, { x: 0.112, w: 0.062, len: 0.38, h: 0.072, wheels: 6, wr: 0.021, sprocket: orange, hub: L.hullDark, lite, links: 10, rollers: 2, rich: true });
  // leichte, schmale Wanne / light narrow hull
  b.add(geo.profileZY([[-0.18, 0.03], [0.14, 0.03], [0.195, 0.07], [0.17, 0.115], [-0.175, 0.115], [-0.19, 0.085]], 0.17), L.hull);
  b.block(0, 0.074, -0.005, 0.3, 0.012, 0.37, L.hull);
  // Container-Zusatzpanzerung an den Seiten / container add-on armour on the sides
  for (const s of [-1, 1]) {
    container(b, s * 0.12, 0.112, -0.03, 0.07, 0.05, 0.13, orange, lite ? 0 : 5, 'z');
    container(b, s * 0.12, 0.112, 0.11, 0.07, 0.05, 0.08, L.hull, lite ? 0 : 3, 'z');
  }
  // Warnstreifen auf dem Bug / hazard stripes on the bow
  b.group({ p: [0, 0.095, 0.178], r: [0.65, 0, 0] }, () => {
    b.box(0.17, 0.004, 0.04, mat.ink, [0, 0, 0]);
    for (let i = 0; i < 5; i++) b.box(0.014, 0.006, 0.05, orange, [-0.07 + i * 0.035, 0.001, 0], [0, 0.6, 0]);
  });
  if (!lite) {
    // Gepaeckgestell mit Kisten am Heck / rear cargo rack with crates
    for (const s of [-1, 1]) {
      b.tube([s * 0.1, 0.115, -0.17], [s * 0.1, 0.17, -0.17], 0.004, 4, mat.metal);
      b.tube([s * 0.1, 0.17, -0.17], [s * 0.1, 0.17, -0.1], 0.004, 4, mat.metal);
    }
    b.tube([-0.1, 0.17, -0.17], [0.1, 0.17, -0.17], 0.004, 4, mat.metal);
    b.add(geo.cbox(0.06, 0.04, 0.05, 0.006), mat.woodLight, { p: [-0.05, 0.135, -0.145] });
    b.box(0.062, 0.006, 0.052, mat.wood, [-0.05, 0.135, -0.145]);
    b.add(geo.cbox(0.05, 0.035, 0.045, 0.006), mat.woodLight, { p: [0.03, 0.133, -0.148] });
    container(b, 0.03, 0.168, -0.15, 0.09, 0.035, 0.05, L.primary, 3, 'x');
    for (const s of [-1, 1]) {
      if (hi) headlight(b, s * 0.06, 0.1, 0.188, 0.009, L.hullDark);
      else b.box(0.02, 0.014, 0.004, mat.yellow, [s * 0.06, 0.1, 0.19]);
      b.cyl(0.009, 0.01, 0.03, 6, mat.darkMid, [s * 0.075, 0.13, -0.175], [0.4, 0, 0]);
    }
    if (hi) meridonHull(b, L);
  }
  // kleiner Turm mit kurzem Rohr / small turret with short gun
  const ty = 0.115, tz = 0.0;
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, ty, tz], () => {
    b.add(geo.ctaper(0.15, 0.15, 0.13, 0.12, 0.055, 0.02), L.hull, { p: [0, ty + 0.0275, tz] });
    container(b, 0, ty + 0.025, tz - 0.105, 0.13, 0.045, 0.05, orange, lite ? 0 : 4, 'x');
    for (const s of [-1, 1]) b.box(0.004, 0.012, 0.13, orange, [s * 0.072, ty + 0.045, tz]);
    b.add(geo.cbox(0.05, 0.04, 0.03, 0.01), L.hullDark, { p: [0, ty + 0.028, tz + 0.085] });
    gun(b, 0, ty + 0.028, tz + 0.1, 0.17, 0.011, L.hullDark, { brake: 'ring', sleeves: 1, lite, rich: true });
    if (hi) meridonTurret(b, L, ty, tz);
    if (!lite) {
      b.cyl(0.003, 0.003, 0.06, 6, mat.dark, [0.03, ty + 0.03, tz + 0.12], [HALF_PI, 0, 0]);
      cupola(b, L, -0.035, ty + 0.055, tz - 0.02, 0.03, lite);
      roofMg(b, L, 0.04, ty + 0.055, tz - 0.02, null, true);
      commander(b, f, -0.035, ty + 0.065, tz - 0.02, 7);
      antenna(b, 0.05, ty + 0.055, tz - 0.06, 0.2, orange);
      b.add(geo.profileZY([[0, 0], [-0.05, -0.012], [0, -0.024]], 0.004), orange, { p: [0.05, ty + 0.255, tz - 0.084] });
      sideEmblems(b, f, L, 0.075, ty + 0.03, tz + 0.02, 0.022, mat.paper);
    }
  });
}

/** Container-Beschlaege: Eckbeschlaege oben und Verriegelungsstangen an der Stirnseite (+z) / container fittings: top corner castings and locking bars on the end (+z) */
function containerFittings(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, c: ColorLike) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.008, 0.007, 0.008, shade(c, 0.6), [x + sx * (w / 2 - 0.003), y + h / 2 - 0.003, z + sz * (d / 2 - 0.003)]);
  for (const t of [-0.22, 0.22]) {
    b.box(0.003, h * 0.9, 0.003, mat.metal, [x + t * w, y, z + d / 2 + 0.002]);
    b.box(0.007, 0.004, 0.004, mat.dark, [x + t * w + 0.004, y, z + d / 2 + 0.003]);
  }
}

/**
 * Meridon-Wanne, hohe Qualitaet: Containerbeschlaege, Fahrerluke mit Winkelspiegeln, Ladenetz ueber dem Gepaeck, Kanister
 * und Plane im Gestell, Abschleppoesen, Werkzeug, Seil.
 * Meridon hull, high quality: container fittings, driver hatch with periscopes, cargo net over the luggage, jerry cans and
 * tarp in the rack, tow eyes, tools, cable.
 */
function meridonHull(b: Builder, L: Look) {
  const orange = L.trim;
  for (const s of [-1, 1]) {
    containerFittings(b, s * 0.12, 0.112, -0.03, 0.07, 0.05, 0.13, orange);
    containerFittings(b, s * 0.12, 0.112, 0.11, 0.07, 0.05, 0.08, L.hull);
    towHook(b, s * 0.05, 0.055, 0.19, 1, L.hullDark);
    towHook(b, s * 0.09, 0.06, -0.188, -1, L.hullDark);
  }
  squareHatch(b, -0.035, 0.115, 0.12, 0.04, 0.03, L.hull);
  periscope(b, -0.035, 0.115, 0.145, 0, L.hullDark, 0.8);
  periscope(b, 0.03, 0.115, 0.145, 0, L.hullDark, 0.8);
  // Ladenetz ueber den Kisten / cargo net over the crates
  for (let i = 0; i < 4; i++) {
    b.box(0.13, 0.003, 0.003, mat.dark, [-0.01, 0.157, -0.165 + i * 0.012]);
    b.box(0.003, 0.003, 0.05, mat.dark, [-0.07 + i * 0.03, 0.157, -0.147]);
  }
  jerryCan(b, [0.085, 0.115, -0.15], 0, L.hullDark, 0.8);
  tarpRoll(b, [0, 0.182, -0.15], 0.17, 0.012, L.gear, orange);
  toolSet(b, [0.0, 0.115, 0.165], [0, HALF_PI, 0], 0.1, ['shovel', 'bar']);
  towCable(b, [-0.145, 0.088, -0.17], [-0.145, 0.088, 0.17]);
  for (let i = 0; i < 5; i++) b.box(0.02 + (i % 2) * 0.012, 0.004, 0.01, MUD, [-0.08 + i * 0.04, 0.05 + (i % 2) * 0.01, 0.165 + (i % 2) * 0.007], [0.65, 0, 0]);
}

/** Meridon-Turm, hohe Qualitaet: Blendenbolzen, Nebelwerfer, Haltegriffe, Containerbeschlaege, Antennenfuss / Meridon turret, high quality */
function meridonTurret(b: Builder, L: Look, ty: number, tz: number) {
  mantletBolts(b, 0, ty + 0.028, tz + 0.1, 0.05, 0.04, L.hull);
  containerFittings(b, 0, ty + 0.025, tz - 0.105, 0.13, 0.045, 0.05, L.trim);
  for (const s of [-1, 1]) {
    smokeRack(b, [s * 0.072, ty + 0.05, tz + 0.04], s as 1 | -1, 2, L.hullDark, s * 0.4);
    grabRail(b, s * 0.074, ty + 0.03, tz - 0.05, tz + 0.0, s * 0.006);
  }
  antennaBase(b, 0.05, ty + 0.055, tz - 0.06);
}

// ---------- Velkar ----------

/** Sechseckplatte auf einer Flaeche (Normale +x oder +y) / hexagon plate on a face */
function hexPlate(b: Builder, x: number, y: number, z: number, r: number, c: ColorLike, normal: 'x' | 'y' | '-x' | 'z') {
  const rot: V3 = normal === 'y' ? [0, 0, 0] : normal === 'x' ? [0, 0, -HALF_PI] : normal === '-x' ? [0, 0, HALF_PI] : [HALF_PI, 0, 0];
  b.add(geo.cyl(r, r, 0.006, 6), c, { p: [x, y, z], r: rot });
}

function velkar(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'velkar' : L.id;
  const green = L.secondary;
  const hi = !lite && fine();
  tracks(b, { x: 0.13, w: 0.085, len: 0.38, h: 0.08, wheels: 5, wr: 0.028, sprocket: L.hullDark, hub: green, lite, links: 9, rich: true });
  // kompakte, gedrungene Wanne / compact squat hull
  b.add(geo.profileZY([[-0.18, 0.035], [0.13, 0.035], [0.195, 0.08], [0.15, 0.15], [-0.16, 0.155], [-0.19, 0.11]], 0.2), L.hull);
  b.add(geo.rtaper(0.38, 0.36, 0.33, 0.3, 0.035, 0.012), L.hull, { p: [0, 0.1, -0.01] });
  // geschlossene Kettenschuerzen mit Sechseckplatten / enclosed track skirts with hexagon plates
  for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.02, 0.38, 0.016, 0.36, 0.075, 0.006), L.hullDark, { p: [s * 0.183, 0.06, -0.005] });
    b.box(0.006, 0.006, 0.36, green, [s * 0.194, 0.094, -0.005]);
    if (!lite) for (let i = 0; i < 5; i++) {
      hexPlate(b, s * 0.194, 0.06, -0.15 + i * 0.072, 0.03, i % 2 ? L.hull : shade(L.hull, 1.15), s > 0 ? 'x' : '-x');
    }
  }
  if (!lite) {
    // Sechseckplatten auf Bug und Deck / hexagon plates on bow and deck
    b.group({ p: [0, 0.12, 0.172], r: [0.8, 0, 0] }, () => {
      for (const x of [-0.07, 0, 0.07]) hexPlate(b, x, 0.004, 0, 0.03, shade(L.hull, 1.12), 'y');
    });
    for (const x of [-0.11, 0.11]) for (const z of [-0.06, 0.06]) hexPlate(b, x, 0.12, z, 0.026, shade(L.hull, 1.1), 'y');
    // Lichtleisten / light strips
    b.box(0.3, 0.005, 0.006, green, [0, 0.118, 0.155]);
    for (const s of [-1, 1]) {
      b.box(0.005, 0.005, 0.3, green, [s * 0.165, 0.12, -0.01]);
      b.box(0.03, 0.012, 0.004, green, [s * 0.11, 0.1, 0.195]);
    }
    b.add(geo.cbox(0.12, 0.012, 0.06, 0.006), mat.ink, { p: [0, 0.122, -0.14] });
    if (hi) velkarHull(b, L);
  }
  // Embleme an den Schuerzen (Wanne) / emblems on the skirts (hull)
  if (!lite) sideEmblems(b, f, L, 0.198, 0.065, 0.165, 0.022, green);
  // unbemannter Turm (Waffenstation) / unmanned turret (weapon station)
  const ty = 0.12, tz = -0.02;
  // Drehturm: dreht sich zum Ziel (siehe Builder.turret) / turret: turns towards the target (see Builder.turret)
  b.turret([0, ty, tz], () => {
    b.cyl(0.1, 0.11, 0.05, 6, L.hull, [0, ty + 0.025, tz], [0, Math.PI / 6, 0]);
    b.cyl(0.09, 0.1, 0.006, 6, green, [0, ty + 0.053, tz], [0, Math.PI / 6, 0]);
    b.add(geo.rtaper(0.1, 0.12, 0.08, 0.1, 0.045, 0.01), shade(L.hull, 0.9), { p: [0, ty + 0.078, tz + 0.01] });
    b.add(geo.cbox(0.06, 0.04, 0.04, 0.01), L.hullDark, { p: [0, ty + 0.075, tz + 0.08] });
    gun(b, 0, ty + 0.075, tz + 0.1, 0.24, 0.016, L.hullDark, { brake: 'box', sleeves: 1, lite, rich: true });
    if (hi) velkarTurret(b, L, ty, tz);
    if (!lite) {
      // Kamera + Sensormast + kleine Waffenstation / camera + sensor mast + small weapon station
      b.add(geo.cbox(0.03, 0.026, 0.032, 0.006), mat.dark, { p: [0.055, ty + 0.1, tz + 0.06] });
      b.cyl(0.009, 0.009, 0.004, 8, green, [0.055, ty + 0.1, tz + 0.077], [HALF_PI, 0, 0]);
      b.tube([-0.04, ty + 0.1, tz - 0.04], [-0.04, ty + 0.23, tz - 0.05], 0.005, 6, mat.dark);
      b.add(geo.rbox(0.05, 0.03, 0.03, 0.008), L.hullDark, { p: [-0.04, ty + 0.245, tz - 0.05] });
      b.box(0.03, 0.014, 0.004, green, [-0.04, ty + 0.245, tz - 0.034]);
      b.cyl(0.03, 0.03, 0.004, 12, mat.white, [-0.04, ty + 0.268, tz - 0.05]);
      roofMg(b, L, 0.045, ty + 0.1, tz - 0.035, null, true);
      b.add(geo.cbox(0.02, 0.016, 0.02, 0.004), mat.dark, { p: [0.045, ty + 0.15, tz - 0.035] });
      b.box(0.006, 0.006, 0.004, green, [0.045, ty + 0.15, tz - 0.024]);
      for (const s of [-1, 1]) b.box(0.006, 0.006, 0.09, green, [s * 0.06, ty + 0.1, tz + 0.01]);
      antenna(b, 0.08, ty + 0.05, tz - 0.08, 0.18, green);
      // Schneetarn / snow camo
      for (const [x, z] of [[0.06, -0.06], [-0.07, 0.03], [0.03, 0.05]] as [number, number][]) b.box(0.03, 0.004, 0.024, mat.snow, [x, ty + 0.1, tz + z]);
    }
  });
}

/**
 * Velkar-Wanne, hohe Qualitaet: Plattenfugen mit Leuchtakzent, Sensorkuppeln an den Ecken, Kabelkanaele an den Flanken,
 * geschlossene Fahrerluke mit Kamera, Lueftungsgitter, Abschleppoesen, Schneereste an den Schuerzen.
 * Velkar hull, high quality: panel joints with a light accent, sensor domes at the corners, cable ducts on the flanks,
 * closed driver hatch with camera, ventilation grilles, tow eyes, snow on the skirts.
 */
function velkarHull(b: Builder, L: Look) {
  const green = L.secondary, seamC = shade(L.hull, 0.72);
  squareHatch(b, -0.07, 0.1175, 0.11, 0.05, 0.04, shade(L.hull, 1.08));
  periscope(b, -0.07, 0.1175, 0.14, 0, mat.dark, 0.85);
  for (const s of [-1, 1]) {
    // Sensorkuppeln an den Bugecken / sensor domes at the bow corners
    b.add(geo.hemi(0.011, 10, 3), mat.glassDark, { p: [s * 0.15, 0.1175, 0.14] });
    b.add(geo.torus(0.012, 0.002, 3, 10), mat.dark, { p: [s * 0.15, 0.1185, 0.14], r: [HALF_PI, 0, 0] });
    // Kabelkanal an der Flanke / cable duct on the flank
    b.add(geo.cbox(0.008, 0.012, 0.28, 0.003), L.hullDark, { p: [s * 0.19, 0.108, -0.02] });
    for (let i = 0; i < 4; i++) b.box(0.01, 0.014, 0.004, mat.dark, [s * 0.19, 0.108, -0.14 + i * 0.08]);
    towHook(b, s * 0.07, 0.07, 0.195, 1, L.hullDark);
    towHook(b, s * 0.12, 0.07, -0.19, -1, L.hullDark);
    seam(b, [s * 0.165, 0.118, -0.16], [s * 0.165, 0.118, 0.14], seamC);
    grille(b, [s * 0.09, 0.1175, -0.165], 0.06, 0.04, 4, L.hullDark);
  }
  seam(b, [-0.15, 0.118, 0.03], [0.15, 0.118, 0.03], seamC);
  b.box(0.04, 0.004, 0.004, green, [0.06, 0.12, 0.03]);
  // Schneereste an den Schuerzen / snow on the skirts
  mudBand(b, 53, 0.194, 0.025, 0.07, -0.18, 0.17, 12, true, [mat.snow, shade(mat.snow, 0.9)]);
}

/** Velkar-Turm, hohe Qualitaet: Blendenbolzen, Bolzenkranz, Nebelwerfer, Kamerakuppel, Plattenfugen, Kabel / Velkar turret, high quality */
function velkarTurret(b: Builder, L: Look, ty: number, tz: number) {
  const green = L.secondary;
  mantletBolts(b, 0, ty + 0.075, tz + 0.1, 0.06, 0.04, L.hull);
  boltRing(b, [0, ty + 0.054, tz], 0.093, 12, L.hullDark, 0.0045, Math.PI / 12);
  for (const s of [-1, 1]) {
    smokeRack(b, [s * 0.075, ty + 0.105, tz + 0.03], s as 1 | -1, 3, L.hullDark, s * 0.25);
    seam(b, [s * 0.04, ty + 0.1005, tz - 0.04], [s * 0.04, ty + 0.1005, tz + 0.05], shade(L.hull, 0.75));
  }
  b.add(geo.hemi(0.012, 10, 3), mat.glassDark, { p: [-0.065, ty + 0.1, tz + 0.03] });
  b.tube([-0.04, ty + 0.105, tz - 0.045], [-0.02, ty + 0.1, tz - 0.06], 0.0025, 4, mat.dark);
  b.box(0.03, 0.003, 0.003, green, [0, ty + 0.101, tz + 0.055]);
}

export function tank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  switch (f) {
    case 'korvat': case 'vesper': korvat(b, L, lite); break;
    case 'dravon': dravon(b, L, lite); break;
    case 'alvenia': alvenia(b, L, lite); break;
    case 'meridon': meridon(b, L, lite); break;
    case 'velkar': case 'zyrr': case 'nexus': velkar(b, L, lite); break;
  }
  return b;
}

