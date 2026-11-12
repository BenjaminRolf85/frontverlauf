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
import { Builder, geo, shade, type ColorLike, type V3 } from './kit';
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
}

/** Kettenlauf beidseitig / track run on both sides */
export function tracks(b: Builder, o: TrackOpts) {
  const hl = o.len / 2;
  const h = o.h;
  const prof: [number, number][] = [
    [-hl, h * 0.32], [-hl + 0.035, 0], [hl - 0.035, 0], [hl + 0.006, h * 0.36], [hl, h * 0.74], [hl - 0.022, h],
    [-hl + 0.022, h], [-hl - 0.004, h * 0.72],
  ];
  for (const s of [-1, 1]) {
    b.add(geo.profileZY(prof, o.w), mat.dark, { p: [s * o.x, 0, 0] });
    const ox = s * (o.x + o.w / 2 + 0.004);
    const span = o.len - 0.11;
    for (let i = 0; i < o.wheels; i++) {
      const z = -span / 2 + (i / (o.wheels - 1)) * span;
      b.cyl(o.wr, o.wr, 0.012, o.lite ? 8 : 12, mat.metal, [ox, o.wr + 0.004, z], [0, 0, HALF_PI]);
      if (!o.lite) b.cyl(o.wr * 0.42, o.wr * 0.42, 0.018, 6, o.hub, [ox, o.wr + 0.004, z], [0, 0, HALF_PI]);
    }
    const sr = h * 0.28;
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
    const n = o.links ?? 10;
    for (let i = 0; i < n; i++) b.box(o.w + 0.006, 0.007, 0.012, mat.ink, [s * o.x, h + 0.002, -hl + 0.04 + (i / (n - 1)) * (o.len - 0.08)]);
  }
}

interface GunOpts { brake?: 'box' | 'ring' | 'big' | 'none'; sleeves?: number; lite: boolean; seg?: number }
/** Kanonenrohr entlang +z / gun barrel along +z */
export function gun(b: Builder, x: number, y: number, z0: number, len: number, r: number, c: ColorLike, o: GunOpts) {
  const seg = o.lite ? 8 : (o.seg ?? 10);
  b.cyl(r, r * 1.12, len, seg, c, [x, y, z0 + len / 2], [HALF_PI, 0, 0]);
  if (!o.lite) for (let i = 0; i < (o.sleeves ?? 0); i++) b.cyl(r * 1.3, r * 1.3, 0.03, seg, c, [x, y, z0 + len * (0.3 + i * 0.22)], [HALF_PI, 0, 0]);
  const zt = z0 + len;
  switch (o.brake ?? 'ring') {
    case 'big':
      b.add(geo.cbox(r * 3.4, r * 2.5, 0.06, r * 0.6), mat.dark, { p: [x, y, zt - 0.02] });
      if (!o.lite) for (const sx of [-1, 1]) for (const dz of [-0.035, -0.012]) b.box(0.004, r * 1.8, 0.012, mat.ink, [x + sx * r * 1.72, y, zt + dz]);
      break;
    case 'box':
      b.add(geo.cbox(r * 2.6, r * 2.2, 0.04, r * 0.5), mat.dark, { p: [x, y, zt - 0.012] });
      break;
    case 'ring':
      b.cyl(r * 1.4, r * 1.4, 0.028, seg, mat.dark, [x, y, zt - 0.012], [HALF_PI, 0, 0]);
      break;
    case 'none':
      break;
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
  for (const a of [0.3, 1.2, -0.6]) b.box(0.014, 0.01, 0.006, mat.glassDark, [x + Math.sin(a) * r, y + 0.018, z + Math.cos(a) * r], [0, a, 0]);
  b.add(geo.cyl(r * 0.85, r * 0.85, 0.008, 10), L.hull, { p: [x, y + 0.045, z - r - 0.008], r: [-1.25, 0, 0] });
}

export function antenna(b: Builder, x: number, y: number, z: number, h: number, tip: ColorLike, lean = -0.12) {
  b.box(0.012, 0.012, 0.012, mat.dark, [x, y + 0.006, z]);
  b.tube([x, y, z], [x, y + h, z + h * lean], 0.003, 4, mat.dark);
  b.add(geo.ico(0.008, 0), tip, { p: [x, y + h + 0.004, z + h * lean] });
}

/** Leichtes MG auf Lafette / light MG on a mount */
export function roofMg(b: Builder, L: Look, x: number, y: number, z: number, shield: ColorLike | null) {
  b.cyl(0.006, 0.008, 0.03, 6, mat.dark, [x, y + 0.015, z]);
  b.add(geo.cbox(0.016, 0.02, 0.05, 0.004), mat.dark, { p: [x, y + 0.035, z + 0.01] });
  b.cyl(0.004, 0.004, 0.07, 6, mat.metal, [x, y + 0.038, z + 0.07], [HALF_PI, 0, 0]);
  b.box(0.018, 0.016, 0.012, L.gear, [x + 0.016, y + 0.028, z]);
  if (shield) b.box(0.05, 0.03, 0.004, shield, [x, y + 0.04, z + 0.035], [-0.1, 0, 0]);
}

function sideEmblems(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, size: number, c: ColorLike = L.emblem) {
  addEmblem(b, f, size, 0.006, c, { p: [x, y, z], r: [0, HALF_PI, 0] });
  addEmblem(b, f, size, 0.006, c, { p: [-x, y, z], r: [0, -HALF_PI, 0] });
}

// ---------- Korvat ----------

function korvat(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'korvat' : L.id;
  tracks(b, { x: 0.135, w: 0.095, len: 0.42, h: 0.095, wheels: 5, wr: 0.038, sprocket: L.trim, hub: L.hullDark, lite, links: 11 });
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
      b.add(geo.cbox(0.03, 0.022, 0.02, 0.005), mat.dark, { p: [s * 0.15, 0.12, 0.2] });
      b.box(0.022, 0.016, 0.004, mat.yellow, [s * 0.15, 0.12, 0.211]);
    }
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
  b.add(geo.rtaper(0.24, 0.24, 0.18, 0.17, 0.09, 0.028, 0.005), L.hull, { p: [0, ty + 0.045, tz] });
  b.add(geo.cyl(0.124, 0.124, 0.012, lite ? 10 : 16, true), L.trim, { p: [0, ty + 0.018, tz] });
  b.add(geo.rbox(0.15, 0.06, 0.05, 0.016), L.hullDark, { p: [0, ty + 0.045, tz + 0.12] });
  // ZWEI parallele Rohre / TWO parallel barrels
  for (const x of [-0.034, 0.034]) gun(b, x, ty + 0.048, tz + 0.14, 0.235, 0.015, L.hullDark, { brake: 'box', sleeves: 1, lite });
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
    antenna(b, 0.075, ty + 0.09, tz - 0.1, 0.2, L.trim);
    sideEmblems(b, f, L, 0.112, ty + 0.05, tz - 0.02, 0.032);
  }
}

// ---------- Dravon ----------

function dravon(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'dravon' : L.id;
  const gold = L.secondary;
  tracks(b, { x: 0.13, w: 0.085, len: 0.44, h: 0.085, wheels: 6, wr: 0.03, sprocket: gold, hub: L.hullDark, lite, links: 12 });
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
      b.add(geo.taper(0.03, 0.014, 0.02, 0.008, 0.018), mat.dark, { p: [s * 0.11, 0.13, 0.17] });
      b.box(0.022, 0.012, 0.004, mat.yellow, [s * 0.11, 0.13, 0.177]);
      b.cyl(0.011, 0.013, 0.04, 8, mat.darkMid, [s * 0.1, 0.15, -0.19], [0.6, 0, 0]);
    }
    for (let i = 0; i < 5; i++) b.box(0.18, 0.006, 0.01, mat.ink, [0, 0.141, -0.04 - i * 0.026]);
  }
  // scharfer Keilturm weit hinten / sharp wedge turret set far back
  const ty = 0.14, tz = -0.08;
  b.add(geo.prismXZ([[-0.12, -0.12], [0.12, -0.12], [0.13, 0.03], [0.06, 0.15], [-0.06, 0.15], [-0.13, 0.03]], 0.072), L.hull, { p: [0, ty, tz] });
  b.add(geo.prismXZ([[-0.1, -0.1], [0.1, -0.1], [0.11, 0.02], [0.04, 0.12], [-0.04, 0.12], [-0.11, 0.02]], 0.02), shade(L.hull, 0.85), { p: [0, ty + 0.072, tz] });
  b.add(geo.prismXZ([[-0.125, -0.12], [0.125, -0.12], [0.135, 0.03], [-0.135, 0.03]], 0.008), gold, { p: [0, ty + 0.034, tz] });
  b.add(geo.prismXZ([[-0.12, -0.13], [0.12, -0.13], [0.12, -0.12], [-0.12, -0.12]], 0.05), mat.dark, { p: [0, ty + 0.01, tz] });
  // ueberlanges Geschuetz mit grosser Muendungsbremse / very long gun with big muzzle brake
  b.add(geo.cbox(0.07, 0.05, 0.05, 0.012), shade(L.hull, 0.8), { p: [0, ty + 0.036, tz + 0.16] });
  gun(b, 0, ty + 0.036, tz + 0.18, 0.33, 0.021, shade(L.hull, 0.8), { brake: 'big', sleeves: 2, lite });
  if (!lite) {
    // Koax-MG, Dach-MG, Kommandant, Antennen, Embleme / coaxial MG, roof MG, commander, antennas, emblems
    b.cyl(0.004, 0.004, 0.08, 6, mat.dark, [0.045, ty + 0.03, tz + 0.2], [HALF_PI, 0, 0]);
    roofMg(b, L, 0.06, ty + 0.092, tz - 0.01, gold);
    cupola(b, L, -0.05, ty + 0.092, tz - 0.03, 0.034, lite);
    commander(b, f, -0.05, ty + 0.1, tz - 0.03, 7);
    antenna(b, 0.09, ty + 0.072, tz - 0.1, 0.18, gold);
    antenna(b, -0.09, ty + 0.072, tz - 0.1, 0.15, gold);
    sideEmblems(b, f, L, 0.127, ty + 0.05, tz - 0.04, 0.03, gold);
    b.box(0.006, 0.006, 0.12, gold, [0, ty + 0.093, tz]);
  }
}

// ---------- Alvenia ----------

function alvenia(b: Builder, L: Look, lite: boolean) {
  const f: FactionId = L.id === 'neutral' ? 'alvenia' : L.id;
  const white = L.trim;
  tracks(b, { x: 0.128, w: 0.08, len: 0.42, h: 0.08, wheels: 6, wr: 0.028, sprocket: L.hullDark, hub: white, lite, links: 11 });
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
      b.add(geo.cyl(0.012, 0.012, 0.012, 8), mat.dark, { p: [s * 0.1, 0.11, 0.195], r: [HALF_PI - 0.5, 0, 0] });
      b.cyl(0.009, 0.009, 0.004, 8, mat.yellow, [s * 0.1, 0.114, 0.201], [HALF_PI - 0.5, 0, 0]);
    }
    for (let i = 0; i < 4; i++) b.box(0.16, 0.004, 0.012, mat.ink, [0, 0.115, -0.08 - i * 0.026]);
  }
  // glatter, flacher Turm mit Panzermodulen / smooth low turret with armour modules
  const ty = 0.13, tz = -0.02;
  b.add(geo.rtaper(0.24, 0.25, 0.17, 0.17, 0.07, 0.022, 0.012), L.hull, { p: [0, ty + 0.035, tz] });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) b.add(geo.rbox(0.03, 0.05, 0.06, 0.008), shade(L.hull, 0.9), { p: [s * 0.12, ty + 0.032, tz - 0.07 + i * 0.065], r: [0, 0, s * 0.18] });
    b.add(geo.rtaper(0.07, 0.03, 0.05, 0.02, 0.05, 0.006), shade(L.hull, 0.9), { p: [s * 0.075, ty + 0.03, tz + 0.12], r: [0.3, s * 0.2, 0] });
  }
  // weisse Streifen auf dem Turmdach / white stripes on the turret roof
  for (const x of [-0.03, 0.03]) b.box(0.016, 0.004, 0.16, white, [x, ty + 0.071, tz - 0.01]);
  b.add(geo.cbox(0.07, 0.05, 0.04, 0.012), L.hullDark, { p: [0, ty + 0.035, tz + 0.13] });
  gun(b, 0, ty + 0.035, tz + 0.15, 0.27, 0.015, L.hullDark, { brake: 'ring', sleeves: 3, lite, seg: 12 });
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
    commander(b, f, -0.05, ty + 0.08, tz - 0.04, 7);
    antenna(b, -0.09, ty + 0.07, tz - 0.1, 0.2, white);
    b.add(geo.cbox(0.16, 0.03, 0.035, 0.008), L.hullDark, { p: [0, ty + 0.035, tz - 0.135] });
    sideEmblems(b, f, L, 0.137, ty + 0.035, tz - 0.0, 0.026, white);
  }
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
  tracks(b, { x: 0.112, w: 0.062, len: 0.38, h: 0.072, wheels: 6, wr: 0.021, sprocket: orange, hub: L.hullDark, lite, links: 10, rollers: 2 });
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
      b.box(0.02, 0.014, 0.004, mat.yellow, [s * 0.06, 0.1, 0.19]);
      b.cyl(0.009, 0.01, 0.03, 6, mat.darkMid, [s * 0.075, 0.13, -0.175], [0.4, 0, 0]);
    }
  }
  // kleiner Turm mit kurzem Rohr / small turret with short gun
  const ty = 0.115, tz = 0.0;
  b.add(geo.ctaper(0.15, 0.15, 0.13, 0.12, 0.055, 0.02), L.hull, { p: [0, ty + 0.0275, tz] });
  container(b, 0, ty + 0.025, tz - 0.105, 0.13, 0.045, 0.05, orange, lite ? 0 : 4, 'x');
  for (const s of [-1, 1]) b.box(0.004, 0.012, 0.13, orange, [s * 0.072, ty + 0.045, tz]);
  b.add(geo.cbox(0.05, 0.04, 0.03, 0.01), L.hullDark, { p: [0, ty + 0.028, tz + 0.085] });
  gun(b, 0, ty + 0.028, tz + 0.1, 0.17, 0.011, L.hullDark, { brake: 'ring', sleeves: 1, lite });
  if (!lite) {
    b.cyl(0.003, 0.003, 0.06, 6, mat.dark, [0.03, ty + 0.03, tz + 0.12], [HALF_PI, 0, 0]);
    cupola(b, L, -0.035, ty + 0.055, tz - 0.02, 0.03, lite);
    commander(b, f, -0.035, ty + 0.065, tz - 0.02, 7);
    antenna(b, 0.05, ty + 0.055, tz - 0.06, 0.2, orange);
    b.add(geo.profileZY([[0, 0], [-0.05, -0.012], [0, -0.024]], 0.004), orange, { p: [0.05, ty + 0.255, tz - 0.084] });
    sideEmblems(b, f, L, 0.075, ty + 0.03, tz + 0.02, 0.022, mat.paper);
  }
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
  tracks(b, { x: 0.13, w: 0.085, len: 0.38, h: 0.08, wheels: 5, wr: 0.028, sprocket: L.hullDark, hub: green, lite, links: 9 });
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
  }
  // unbemannter Turm (Waffenstation) / unmanned turret (weapon station)
  const ty = 0.12, tz = -0.02;
  b.cyl(0.1, 0.11, 0.05, 6, L.hull, [0, ty + 0.025, tz], [0, Math.PI / 6, 0]);
  b.cyl(0.09, 0.1, 0.006, 6, green, [0, ty + 0.053, tz], [0, Math.PI / 6, 0]);
  b.add(geo.rtaper(0.1, 0.12, 0.08, 0.1, 0.045, 0.01), shade(L.hull, 0.9), { p: [0, ty + 0.078, tz + 0.01] });
  b.add(geo.cbox(0.06, 0.04, 0.04, 0.01), L.hullDark, { p: [0, ty + 0.075, tz + 0.08] });
  gun(b, 0, ty + 0.075, tz + 0.1, 0.24, 0.016, L.hullDark, { brake: 'box', sleeves: 1, lite });
  if (!lite) {
    // Kamera + Sensormast + kleine Waffenstation / camera + sensor mast + small weapon station
    b.add(geo.cbox(0.03, 0.026, 0.032, 0.006), mat.dark, { p: [0.055, ty + 0.1, tz + 0.06] });
    b.cyl(0.009, 0.009, 0.004, 8, green, [0.055, ty + 0.1, tz + 0.077], [HALF_PI, 0, 0]);
    b.tube([-0.04, ty + 0.1, tz - 0.04], [-0.04, ty + 0.23, tz - 0.05], 0.005, 6, mat.dark);
    b.add(geo.rbox(0.05, 0.03, 0.03, 0.008), L.hullDark, { p: [-0.04, ty + 0.245, tz - 0.05] });
    b.box(0.03, 0.014, 0.004, green, [-0.04, ty + 0.245, tz - 0.034]);
    b.cyl(0.03, 0.03, 0.004, 12, mat.white, [-0.04, ty + 0.268, tz - 0.05]);
    roofMg(b, L, 0.045, ty + 0.1, tz - 0.035, null);
    b.add(geo.cbox(0.02, 0.016, 0.02, 0.004), mat.dark, { p: [0.045, ty + 0.15, tz - 0.035] });
    b.box(0.006, 0.006, 0.004, green, [0.045, ty + 0.15, tz - 0.024]);
    for (const s of [-1, 1]) b.box(0.006, 0.006, 0.09, green, [s * 0.06, ty + 0.1, tz + 0.01]);
    antenna(b, 0.08, ty + 0.05, tz - 0.08, 0.18, green);
    sideEmblems(b, f, L, 0.198, 0.065, 0.165, 0.022, green);
    // Schneetarn / snow camo
    for (const [x, z] of [[0.06, -0.06], [-0.07, 0.03], [0.03, 0.05]] as [number, number][]) b.box(0.03, 0.004, 0.024, mat.snow, [x, ty + 0.1, tz + z]);
  }
}

export function tank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  switch (f) {
    case 'korvat': korvat(b, L, lite); break;
    case 'dravon': dravon(b, L, lite); break;
    case 'alvenia': alvenia(b, L, lite); break;
    case 'meridon': meridon(b, L, lite); break;
    case 'velkar': case 'zyrr': velkar(b, L, lite); break;
  }
  return b;
}

