/**
 * Gezeichnete Einheiten: Maschinen der Zyrr (Atlas 'alien'): Terraformer, Gleiter, Mech, Dreibeiner.
 * Inked units: the Zyrr's machines (atlas 'alien'): terraformer, skimmer, mech, tripod.
 *
 * Fremdartig heisst hier: glatte, organische Koerper (Lofts, Schlaeuche entlang von Kurven) statt Platten. Gezeichnet
 * sind Naehte, Rippen, Pigmentflecken, Kiemenschlitze, Saugnaepfe, Glas mit Pilot; die Leuchtfarben (mat.acid,
 * mat.xenoGlow) stehen genau so in den Vertexfarben oder als deckende Farbe in der Zelle. Die Fraktionsfarbe kommt vom
 * Besitzer (look), die Grundstoffe bleiben fremdartig.
 * Alien here means: smooth organic bodies (lofts, tubes along curves) instead of plates. Drawn are seams, ribs,
 * pigment spots, gill slits, suckers, glass with a pilot; the glow colours (mat.acid, mat.xenoGlow) sit exactly like
 * that in the vertex colours or as opaque colour in the cell. The faction colour comes from the owner (look), the base
 * materials stay alien.
 */
import type { FactionId } from '../../../data/balance';
import { fine, mix, rng, softBox, type ColorLike, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { ball, ballRings, bez3, crate, flatRing, loftZ, planarY, rod, sheet, sweep, TIP } from './navalKit';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, UvBuilder, type Ring } from './uvkit';

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Linsenfoermige Scheibe: Oberseite mit ebener Zeichnung, Rand in Zweitfarbe, Unterseite / lens-shaped disc: top with a planar drawing, rim in the secondary colour, underside */
export function saucer(b: UvBuilder, A: AtlasLayout, L: Look, y: number, R: number, rz: number, up: number, down: number, rim: number): void {
  const hi = fine();
  const seg = hi ? 40 : 22, rows = hi ? 6 : 4;
  const k = rz / R;
  const top: Ring[] = [];
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * (Math.PI / 2);
    top.push({ y: y + Math.cos(a) * up, rx: Math.max(TIP, Math.sin(a) * R), rz: Math.max(TIP, Math.sin(a) * R * k), ...(i === 0 ? { c: L.primary } : {}) });
  }
  b.add(planarY(loft(top, { seg, region: A.get('saucerTop') }), A.get('saucerTop'), R * 1.02), null, { crease: 0 });
  // Randwulst mit Lichtern / rim bead with lights
  b.add(loft([
    { y: y + rim, rx: R * 0.985, rz: R * 0.985 * k, c: L.secondary }, { y, rx: R + rim * 0.8, rz: (R + rim * 0.8) * k }, { y: y - rim, rx: R * 0.985, rz: R * 0.985 * k },
  ], { seg, region: A.get('rim') }), null, { gloss: 0.3 });
  const bot: Ring[] = [];
  for (let i = 0; i <= rows; i++) {
    const a = (i / rows) * (Math.PI / 2);
    bot.push({ y: y - Math.sin(a) * down, rx: Math.max(TIP, Math.cos(a) * R * 0.98), rz: Math.max(TIP, Math.cos(a) * R * 0.98 * k), ...(i === 0 ? { c: mat.alienMetal } : {}) });
  }
  b.add(planarY(loft(bot, { seg, region: A.get('saucerBottom') }), A.get('saucerBottom'), R * 1.02, 0, 0, true), null, { crease: 0 });
}

/** Glaskuppel mit Rahmenring; in der Zelle sitzt der Pilot / glass dome with a frame ring; the pilot sits in the cell */
function canopy(b: UvBuilder, A: AtlasLayout, p: V3, r: number, h: number, rz: number): void {
  const hi = fine();
  const glass = mix(mat.xenoGlow, mat.glassDark, 0.55);
  const rings: Ring[] = ballRings(r, h, hi ? 6 : 4, glass, 0, Math.PI / 2).map((q) => ({ ...q, rz: Math.max(TIP, q.rx * (rz / r)) }));
  rings.push({ y: -0.006, rx: r * 1.08, rz: rz * 1.08, hard: true, c: mat.alienMetalLight });
  rings[rings.length - 2].hard = true;
  rings[rings.length - 2].c = mat.alienMetalLight;
  b.add(loft(rings, { seg: hi ? 20 : 14, region: A.get('canopy'), arc: true }), null, { xf: { p }, gloss: 0.9, crease: 0.5 });
}

/** Tentakel oder Schlauch entlang einer Bezierkurve / tentacle or hose along a Bezier curve */
export function tentacle(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, e: V3, r0: number, r1: number, color: ColorLike, face: V3, n = fine() ? 8 : 4, cell = 'tentacle'): void {
  b.add(sweep(bez3(a, c, e, n), (t) => (t > 0.985 ? r1 * 0.5 : r0 + (r1 - r0) * t), { seg: fine() ? 10 : 6, region: A.get(cell), color, face, capEnd: true }), null, { crease: 0 });
}

/** Leuchtender Behaelter: Metallkappen, dazwischen Glas mit Fluessigkeit / glowing vessel: metal caps, glass with fluid in between */
function glowTank(b: UvBuilder, A: AtlasLayout, p: V3, r: number, h: number, rot: V3): void {
  const seg = fine() ? 16 : 10;
  b.add(loft([
    { y: h / 2 + 0.008, rx: r * 1.14, hard: true, c: mat.alienMetal }, { y: h / 2 - 0.002, rx: r * 1.14, hard: true },
    { y: h / 2 - 0.005, rx: r, hard: true, c: mat.acid }, { y: -h / 2 + 0.005, rx: r, hard: true, c: mat.alienMetal },
    { y: -h / 2 + 0.002, rx: r * 1.14, hard: true }, { y: -h / 2 - 0.008, rx: r * 1.14, hard: true },
  ], { seg, region: A.get('tank'), capFirst: true, capLast: true }), null, { xf: { p, r: rot }, gloss: 0.7 });
}

// ---------- Terraformer ----------

export function terraformer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const C: V3 = [0, 0.3, -0.03];
  const seg = hi ? 28 : 16;
  // schwebender Panzerruecken mit drei Wachstumsringen in Zweitfarbe / floating carapace with three growth rings in the secondary colour
  const R = 0.127, RZ = 0.146, H = 0.1;
  const dome: Ring[] = [{ y: H, rx: TIP, c: L.primary }];
  // [Winkel, 1 = Band beginnt, 2 = Band endet] / [angle, 1 = band starts, 2 = band ends]
  for (const [a, band] of [[0.2, 0], [0.42, 1], [0.5, 2], [0.74, 1], [0.82, 2], [1.08, 1], [1.16, 2], [1.42, 0], [Math.PI / 2, 0]] as [number, number][]) {
    dome.push({ y: Math.cos(a) * H, rx: Math.sin(a) * R, rz: Math.sin(a) * RZ, ...(band === 1 ? { c: L.secondary, hard: true } : band === 2 ? { c: L.primary, hard: true } : {}) });
  }
  b.add(loft(dome, { seg, region: A.get('carapace'), arc: true }), null, { xf: { p: C }, crease: 0.6 });
  // weicher Bauch mit drei Augen vorn / soft belly with three eyes at the front
  b.add(loft([
    { y: 0.004, rx: R * 0.96, rz: RZ * 0.96, hard: true, c: mat.alienSkin }, { y: -0.03, rx: R * 0.9, rz: RZ * 0.9 }, { y: -0.056, rx: R * 0.62, rz: RZ * 0.62 }, { y: -0.066, rx: TIP },
  ], { seg, region: A.get('belly') }), null, { xf: { p: C }, crease: 0 });
  emblemDecal(b, A, f, [0, C[1] + H * 0.93, C[2] - 0.045], [0, 1, -0.32], 0.034, L.primary, [0, 0.3, 1]);
  // drei vorstehende Augen unter dem Panzerrand: das Gesicht des Terraformers, auch von oben zu sehen
  // three protruding eyes below the carapace rim: the terraformer's face, visible from above too
  for (const [x, y] of [[-0.042, 0], [0.042, 0], [0, 0.03]] as [number, number][]) {
    const ez = C[2] + RZ * Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * (y ? 0.86 : 0.97);
    ball(b, A, [x, C[1] - 0.004 + y, ez], 0.021, mat.ink, { rows: hi ? 5 : 3, seg: hi ? 10 : 6, gloss: 0.9 });
    ball(b, A, [x, C[1] + y, ez + 0.017], 0.008, mat.acid, { rows: 3, seg: 6 });
  }
  // Behaelter mit leuchtender Fluessigkeit am Ruecken / tank with glowing fluid on the back
  glowTank(b, A, [0, C[1] + 0.07, C[2] - 0.128], 0.034, 0.085, [Math.PI * 0.3, 0, 0]);
  if (hi) for (const s of [-1, 1]) tentacle(b, A, [s * 0.022, C[1] + 0.09, C[2] - 0.15], [s * 0.06, C[1] + 0.115, C[2] - 0.09], [s * 0.066, C[1] + 0.066, C[2] - 0.03], 0.005, 0.005, mat.alienMetalLight, [s, 0.5, 0], 4, 'blank');
  // vier Tentakelbeine mit leuchtenden Spitzen / four tentacle legs with glowing tips
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i / 4) * Math.PI * 2;
    const s0: V3 = [Math.sin(a) * 0.066, C[1] - 0.04, C[2] + Math.cos(a) * 0.066];
    const c1: V3 = [Math.sin(a) * 0.265, C[1] + 0.035, C[2] + Math.cos(a) * 0.265];
    const e: V3 = [Math.sin(a) * 0.295, 0.016, C[2] + Math.cos(a) * 0.295];
    tentacle(b, A, s0, c1, e, 0.022, 0.009, mat.alienSkinDark, [Math.sin(a), 0.6, Math.cos(a)]);
    ball(b, A, e, 0.014, mat.acid, { rows: hi ? 4 : 3, seg: hi ? 8 : 6 });
  }
  // Terraform-Emitter mit Sporenstrahl / terraforming emitter with a spore beam
  const lens: V3 = [0, 0.143, 0.212];
  b.add(sweep([[0, C[1] - 0.05, C[2] + 0.08], [0, 0.2, 0.15], [0, 0.17, 0.185]], (t) => 0.016 - t * 0.003, { seg: hi ? 9 : 5, region: A.get('limb'), color: mat.alienMetal, face: [0, 0.4, 1] }), null, { crease: 0 });
  b.add(loft([{ y: 0.03, rx: 0.014, hard: true, c: mat.alienMetalLight }, { y: -0.012, rx: 0.031, hard: true, c: mat.acid }, { y: -0.018, rx: 0.033, hard: true, c: mat.alienMetalLight }, { y: -0.026, rx: 0.036, hard: true }], { seg: hi ? 14 : 8, region: A.get('blank'), capFirst: true }), null, { xf: { p: [0, 0.166, 0.184], r: [0.62, 0, 0] } });
  ball(b, A, lens, 0.02, mat.xenoGlow, { gloss: 1 });
  const beam = mix(mat.xenoGlow, L.primary, 0.25);
  // der Kegel endet ueber dem Boden (sein schraeger Rand taucht sonst ein), darunter der Leuchtfleck
  // the cone ends above the ground (its slanted rim would dip in otherwise), the glowing patch lies below it
  b.add(sweep([lens, [0, 0.042, 0.298]], (t) => 0.011 + t * 0.04, { seg: hi ? 12 : 6, region: A.get('blank'), color: beam, face: [0, 0, 1] }), null, { crease: 0 });
  b.add(loft([{ y: 0.006, rx: 0.062, hard: true, c: mat.xenoGlow }, { y: 0.002, rx: 0.074 }], { seg: hi ? 16 : 8, region: A.get('blank'), capFirst: true }), null, { xf: { p: [0, 0, 0.325] }, crease: 0 });
  if (hi) {
    // Sporen im Strahl / spores in the beam
    const R2 = rng(91);
    for (let i = 0; i < 6; i++) {
      const p = lerp3(lens, [0, 0.0, 0.33], 0.25 + R2() * 0.7);
      ball(b, A, [p[0] + (R2() - 0.5) * 0.09, p[1] + 0.012, p[2] + (R2() - 0.5) * 0.06], 0.007 + R2() * 0.005, i % 2 ? mat.acid : mat.xenoGlow, { rows: 3, seg: 6 });
    }
  }
  return b;
}

// ---------- Gleiter / skimmer ----------

export function skimmer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const y = 0.19, R = 0.228, RZ = 0.25;
  saucer(b, A, L, y, R, RZ, 0.064, 0.05, 0.013);
  canopy(b, A, [0, y + 0.05, 0.036], 0.072, 0.066, 0.09);
  // Heckflossen mit Leuchtkante / tail fins with a glowing edge
  for (const s of [-1, 1]) {
    b.group({ p: [s * 0.096, y + 0.03, -0.19], r: [0, s * 0.5, s * 0.3] }, () => {
      sheet(b, [[0, 0.07, -0.01], [0, 0.07, -0.01], [0, 0, -0.13], [0, 0, 0.03]], 0, A.get('fin'), L.primary, { nu: 1, nv: 2, thick: 0.006, crease: 1 });
      rod(b, [-0.003, 0.004, 0.02], [-0.003, 0.004, -0.12], 0.0055, mat.acid, { seg: 4, cap: true });
    });
  }
  // Bugzinken mit Laserkanonen / nose prongs with laser cannons
  const seg = hi ? 10 : 6;
  for (const s of [-1, 1]) {
    b.add(loftZ([
      { z: 0.2, rx: 0.036, ry: 0.014, e: 3, c: L.primaryDark }, { z: 0.275, rx: 0.026, ry: 0.012, e: 3, hard: true, c: mat.alienMetalLight },
      { z: 0.279, rx: 0.0095, hard: true }, { z: 0.345, rx: 0.0085, hard: true, c: mat.acid }, { z: 0.352, rx: 0.013 }, { z: 0.366, rx: TIP },
    ], { seg, region: A.get('blank') }), null, { xf: { p: [s * 0.072, y + 0.006, 0] }, gloss: 0.5 });
  }
  // leuchtende Unterseite und Bodenwellen / glowing underside and ground ripples
  b.add(loft([{ y: 0, rx: 0.075, hard: true, c: mat.xenoGlow }, { y: -0.004, rx: 0.07 }], { seg: hi ? 16 : 8, region: A.get('blank'), capLast: true }), null, { xf: { p: [0, y - 0.047, 0] }, crease: 0 });
  flatRing(b, [0, 0.004, 0], 0.16, 0.007, mix(mat.xenoGlow, mat.white, 0.3), { rz: 0.17 });
  if (hi) flatRing(b, [0, 0.004, 0], 0.26, 0.005, mix(mat.xenoGlow, mat.white, 0.3), { rz: 0.28 });
  emblemDecal(b, A, f, [0, y + 0.052, -0.125], [0, 1, -0.5], 0.04, L.primary, [0, 0.5, 1]);
  if (hi) {
    // Triebwerksgondeln mit Leuchtduesen / engine pods with glowing nozzles
    for (const s of [-1, 1]) b.add(loftZ([
      { z: -0.25, rx: 0.014, hard: true, c: mat.acid }, { z: -0.245, rx: 0.02, hard: true, c: mat.alienMetal }, { z: -0.19, rx: 0.024 }, { z: -0.13, rx: 0.016 }, { z: -0.11, rx: TIP },
    ], { seg: 8, region: A.get('blank'), capFirst: true }), null, { xf: { p: [s * 0.045, y + 0.03, 0] }, gloss: 0.4, crease: 0 });
    rod(b, [0.1, y + 0.04, -0.05], [0.115, y + 0.15, -0.075], 0.0022, mat.dark, { seg: 3 });
  }
  return b;
}

// ---------- Mech ----------

export function mech(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const seg = hi ? 16 : 10;
  // Beine mit Rueckwaertsknien / legs with reverse knees
  b.mirrorX(() => {
    const hip: V3 = [0.088, 0.262, -0.012], knee: V3 = [0.103, 0.166, 0.085], ankle: V3 = [0.103, 0.058, -0.036];
    b.add(sweep([hip, knee], (t) => 0.034 - t * 0.004, { seg, region: A.get('legPlate'), color: L.primary, face: [0, 0, 1], squash: [1, 1.1] }), null, { crease: 0.5 });
    b.add(sweep([knee, ankle], (t) => 0.024 - t * 0.004, { seg, region: A.get('limb'), color: mat.alienMetal, face: [1, 0, 0] }), null, { crease: 0.5, gloss: 0.3 });
    for (const [j, r] of [[hip, 0.032], [knee, 0.03], [ankle, 0.026]] as [V3, number][]) ball(b, A, j, r, mat.alienMetal, { gloss: 0.4 });
    b.add(loft([{ y: 0.006, rx: 0.033, hard: true, c: mat.acid }, { y: -0.006, rx: 0.033, hard: true }], { seg, region: A.get('blank') }), null, { xf: { p: knee, r: [0, 0, Math.PI / 2] }, crease: 0 });
    if (hi) rod(b, [0.128, 0.235, 0.0], [0.128, 0.142, 0.058], 0.008, mat.alienMetalLight, { seg: 6, gloss: 0.6 });
    // Dreizehenfuss mit Sporn / three-toed foot with a spur
    for (const a of hi ? [-0.45, 0, 0.45] : [0]) {
      b.add(loftZ([{ z: -0.01, rx: 0.016, ry: 0.014, ryB: 0.012, e: 3, c: mat.alienMetal }, { z: 0.045, rx: 0.014, ry: 0.011, ryB: 0.012, e: 3 }, { z: 0.078, rx: 0.006, ry: 0.004, ryB: 0.011 }, { z: 0.09, rx: TIP, cy: -0.008 }], { seg: hi ? 8 : 5, region: A.get('blank') }), null, { xf: { p: [0.103 + Math.sin(a) * 0.012, 0.014, -0.03 + Math.cos(a) * 0.006], r: [0, a, 0] }, crease: 0 });
    }
    b.add(loftZ([{ z: -0.05, rx: TIP, cy: -0.006, c: mat.alienMetal }, { z: -0.03, rx: 0.008, ry: 0.007, ryB: 0.01 }, { z: 0, rx: 0.014, ry: 0.012, ryB: 0.012 }], { seg: hi ? 8 : 5, region: A.get('blank') }), null, { xf: { p: [0.103, 0.014, -0.04] }, crease: 0 });
  });
  // Becken / pelvis
  b.add(loft([{ y: 0.03, rx: 0.07, rz: 0.04, e: 3 }, { y: 0, rx: 0.085, rz: 0.05, e: 3 }, { y: -0.03, rx: 0.07, rz: 0.04, e: 3 }], { seg: hi ? 14 : 8, region: A.get('blank'), color: mat.alienMetal, capFirst: true, capLast: true }), null, { xf: { p: [0, 0.262, -0.012] }, crease: 0.4 });
  // Kanzel: glatter Rumpf mit Farbband, vorn die Glaskuppel mit Pilot / cockpit: smooth body with a colour band, the glass dome with the pilot at the front
  const by = 0.292;
  b.add(loft([
    { y: 0.136, rx: 0.07, rz: 0.058, e: 3, c: L.primary, hard: true }, { y: 0.122, rx: 0.094, rz: 0.082, e: 3 }, { y: 0.078, rx: 0.106, rz: 0.1, e: 3.2, hard: true, c: L.secondary },
    { y: 0.062, rx: 0.11, rz: 0.106, e: 3.2, hard: true, c: L.primary }, { y: 0.02, rx: 0.116, rz: 0.112, e: 3.2 }, { y: 0, rx: 0.1, rz: 0.096, e: 3.2 },
  ], { seg: hi ? 26 : 16, region: A.get('mechBody'), capFirst: true }), null, { xf: { p: [0, by, -0.006] }, crease: 0.6 });
  b.group({ p: [0, by + 0.07, 0.068], r: [0.62, 0, 0] }, () => canopy(b, A, [0, 0, 0], 0.062, 0.05, 0.05));
  for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.116, by + 0.036, -0.03], [s, 0.12, 0], 0.036, L.primary);
  // Schultern und Armkanonen mit Leuchtringen / shoulders and arm cannons with glow rings
  for (const s of [-1, 1]) {
    ball(b, A, [s * 0.134, by + 0.074, 0], 0.04, mat.alienMetal, { gloss: 0.4 });
    b.add(loftZ([
      { z: -0.04, rx: 0.02, e: 3, c: L.primaryDark }, { z: -0.026, rx: 0.034, e: 3 }, { z: 0.06, rx: 0.034, e: 3, hard: true, c: mat.alienMetal },
      { z: 0.064, rx: 0.03, hard: true }, { z: 0.1, rx: 0.031, hard: true, c: mat.acid }, { z: 0.108, rx: 0.034, hard: true, c: mat.alienMetal }, { z: 0.15, rx: 0.033, hard: true, c: mat.acid },
      { z: 0.158, rx: 0.035, hard: true, c: mat.alienMetal }, { z: 0.2, rx: 0.034, hard: true, c: mat.acid }, { z: 0.208, rx: 0.036, hard: true, c: mat.alienMetal }, { z: 0.282, rx: 0.036, hard: true, c: mat.ink }, { z: 0.292, rx: 0.033 },
    ], { seg: hi ? 16 : 10, region: A.get('cannon'), capFirst: true, capLast: true }), null, { xf: { p: [s * 0.164, by + 0.022, 0] }, gloss: 0.4 });
    ball(b, A, [s * 0.164, by + 0.022, 0.296], 0.014, mat.acid, { rows: 3, seg: 6 });
  }
  // Raketenkapsel links, Sensor und Antenne rechts / missile pod left, sensor and antenna right
  crate(b, 0.07, 0.056, 0.08, 0.01, { pz: A.get('pod'), all: A.get('blank') }, L.primaryDark, { p: [-0.118, by + 0.15, -0.02] });
  if (hi) {
    b.add(softBox(0.036, 0.03, 0.04, 0.008), mat.alienMetal, { xf: { p: [0.108, by + 0.144, 0.01] } });
    b.add(softBox(0.024, 0.012, 0.006, 0.002), mat.acid, { xf: { p: [0.108, by + 0.146, 0.032] }, crease: 0 });
    rod(b, [0.12, by + 0.15, -0.04], [0.132, by + 0.285, -0.075], 0.003, mat.dark, { seg: 4 });
    ball(b, A, [0.132, by + 0.29, -0.076], 0.008, mat.acid, { rows: 3, seg: 6 });
  }
  // Reaktor am Ruecken / reactor on the back
  glowTank(b, A, [0, by + 0.066, -0.122], 0.034, 0.08, [0.18, 0, 0]);
  return b;
}

// ---------- Dreibeiner / tripod ----------

export function tripod(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const y = 0.4, R = 0.2;
  const seg = hi ? 12 : 8;
  saucer(b, A, L, y, R, R, 0.062, 0.048, 0.015);
  canopy(b, A, [0, y + 0.05, 0], 0.074, 0.07, 0.074);
  rod(b, [0, y + 0.115, 0], [0, y + 0.2, 0], 0.005, mat.alienMetalLight, { r1: 0.002 });
  ball(b, A, [0, y + 0.205, 0], 0.012, mat.acid, { rows: 3, seg: 6 });
  emblemDecal(b, A, f, [0, y + 0.047, -0.13], [0, 1, -0.5], 0.044, L.primary, [0, 0.5, 1]);
  // Todesstrahl-Emitter unter der Scheibe / death-ray emitter under the saucer
  b.add(loft([{ y: 0, rx: 0.032, c: mat.alienMetal }, { y: -0.05, rx: 0.024 }], { seg, region: A.get('blank') }), null, { xf: { p: [0, y - 0.04, 0.03] }, crease: 0 });
  ball(b, A, [0, y - 0.1, 0.035], 0.032, mat.alienMetalLight, { gloss: 0.5 });
  b.group({ p: [0, y - 0.11, 0.06], r: [1.0, 0, 0] }, () => {
    b.add(loft([{ y: 0.092, rx: 0.058, hard: true, c: mat.alienMetalLight }, { y: 0.055, rx: 0.018, hard: true, c: mat.alienMetal }, { y: 0, rx: 0.013 }], { seg: hi ? 14 : 8, region: A.get('blank') }), null, { gloss: 0.4 });
    ball(b, A, [0, 0.086, 0], 0.03, mat.acid, { gloss: 1 });
    if (hi) for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      rod(b, [Math.sin(a) * 0.05, 0.088, Math.cos(a) * 0.05], [Math.sin(a) * 0.02, 0.14, Math.cos(a) * 0.02], 0.004, mat.alienMetal, { seg: 4 });
    }
    ball(b, A, [0, 0.142, 0], 0.012, mat.xenoGlow, { rows: 3, seg: 6 });
  });
  // drei lange, duenne Beine / three long thin legs
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 3 + (i / 3) * Math.PI * 2;
    const dir = (r: number, yy: number): V3 => [Math.sin(a) * r, yy, Math.cos(a) * r];
    const hip = dir(0.12, y - 0.045), knee = dir(0.3, y + 0.1), foot = dir(0.38, 0.03);
    const face: V3 = [Math.sin(a), 0.4, Math.cos(a)];
    ball(b, A, hip, 0.026, mat.alienMetal, { gloss: 0.4 });
    b.add(sweep([hip, knee], (t) => 0.014 - t * 0.002, { seg, region: A.get('limb'), color: L.primaryDark, face }), null, { crease: 0 });
    ball(b, A, knee, 0.024, mat.alienMetal, { gloss: 0.4 });
    if (hi) b.add(loft([{ y: 0.005, rx: 0.027, hard: true, c: mat.acid }, { y: -0.005, rx: 0.027, hard: true }], { seg: 10, region: A.get('blank') }), null, { xf: { p: knee, r: [Math.PI / 2, a, 0] }, crease: 0 });
    // Unterschenkel mit Panzermanschette in Fraktionsfarbe / lower leg with an armour sleeve in the faction colour
    const lp = [0, 0.18, 0.2, 0.55, 0.57, 1].map((t) => lerp3(knee, foot, t));
    const lr = [0.012, 0.0115, 0.018, 0.017, 0.0095, 0.0075];
    b.add(sweep(lp, (_t, k) => lr[k], { seg, region: A.get('limb'), color: mat.alienMetalLight, face, colorAt: (t) => (t > 0.17 && t < 0.56 ? L.primary : mat.alienMetalLight) }), null, { crease: 0.4, gloss: 0.3 });
    // Fuss: Teller mit Krallen / foot: pad with claws
    b.add(loft([{ y: 0.03, rx: 0.014, c: mat.alienMetal }, { y: 0.012, rx: 0.022, hard: true }, { y: 0, rx: 0.03 }], { seg: hi ? 10 : 6, region: A.get('blank') }), null, { xf: { p: [foot[0], 0, foot[2]] }, crease: 0.5 });
    if (hi) for (const da of [-0.7, 0, 0.7]) rod(b, [foot[0] + Math.sin(a + da) * 0.02, 0.01, foot[2] + Math.cos(a + da) * 0.02], [foot[0] + Math.sin(a + da) * 0.046, 0.003, foot[2] + Math.cos(a + da) * 0.046], 0.007, mat.alienMetal, { r1: 0.002, seg: 4 });
  }
  // haengende Tentakel / hanging tentacles
  if (hi) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    tentacle(b, A, [Math.sin(a) * 0.085, y - 0.03, Math.cos(a) * 0.085], [Math.sin(a) * 0.13, y - 0.11, Math.cos(a) * 0.13], [Math.sin(a + 0.4) * 0.075, y - 0.21, Math.cos(a + 0.4) * 0.075], 0.009, 0.004, mat.alienSkinDark, [Math.sin(a), 0, Math.cos(a)], 5);
  }
  return b;
}
