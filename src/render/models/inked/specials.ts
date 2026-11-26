/**
 * Gezeichnete Einheiten: Sonderfiguren der Fraktionen und der Kampagne (Wissenschaftler, Marines, Schattenkommando,
 * Panzerabwehr-Trupp, Railgun-Schuetze, Lichtschuetzen). Alle bauen auf figure() auf: dieselbe Figur, dieselben
 * Proportionen, Massstab FIG.
 * Inked units: special figures of the factions and the campaign (scientist, marines, shadow commando, anti-tank squad,
 * railgun marksman, light wardens). All build on figure(): the same figure, the same proportions, scale FIG.
 */
import type { FactionId } from '../../../data/balance';
import { FAITH, haloRing } from '../alveniaFaith';
import { fine, geo, mix, shade, type ColorLike, type V3 } from '../kit';
import { look, mat, styleOf, type Look } from '../look';
import { TECH } from '../velkarTech';
import { vest } from './armour';
import { ANKLE_Y, bareHead, FACE, FIG, figure, HEAD, headSegments, kneelPose, rifle, standPose, torsoRings, type Detail } from './figure';
import { aimZ, along, bead, box, faces, frontLoft, rod, TIP } from './figkit';
import { combatHelmet, hood } from './heads';
import { banner, board, caseBox, rocketTube, spareRocket } from './props';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, loftAt, projectBox, ribbon, UvBuilder } from './uvkit';

const HALF_PI = Math.PI / 2;

// ---------- Wissenschaftler / scientist ----------

/** Kopf: wirres helles Haar, Schutzbrille auf der Stirn mit Band in Fraktionsfarbe / head: wild light hair, goggles pushed up on the forehead with a strap in the faction colour */
function scientistHead(b: UvBuilder, A: AtlasLayout, L: Look, d: Detail): void {
  const seg = headSegments(d);
  const hair = mix(mat.paper, mat.dark, 0.25);
  bareHead(b, A, seg);
  b.add(loft([
    { y: 0.12, rx: TIP, c: hair }, { y: 0.115, rx: 0.026 }, { y: 0.101, rx: 0.045, rzB: 0.05 }, { y: 0.085, rx: 0.05, rz: 0.045, rzB: 0.055 },
    { y: 0.076, rx: 0.051, rz: 0.034, rzB: 0.056 }, { y: 0.052, rx: 0.049, rz: 0.008, rzB: 0.053 }, { y: 0.032, rx: 0.041, rz: 0.004, rzB: 0.045 }, { y: 0.022, rx: TIP, cz: -0.03 },
  ], { seg, region: A.get('blank') }), null, { xf: { p: [0, 0, -0.004] }, crease: 0.5 });
  // abstehende Bueschel brechen den Umriss / tufts sticking out break the silhouette
  const tufts = d === 2 ? 7 : 4;
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2 + 0.3;
    if (Math.sin(a) > 0.8) continue;
    b.add(loft([{ y: 0, rx: 0.014 }, { y: 0.036 + (i % 3) * 0.008, rx: TIP }], { seg: 5, region: A.get('blank'), color: i % 2 ? hair : shade(hair, 0.86) }), null, { xf: { p: [Math.cos(a) * 0.04, 0.084 + (i % 2) * 0.012, Math.sin(a) * 0.042 - 0.012], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1] }, crease: 0.5 });
  }
  // Schutzbrille: Band und zwei Glaeser / goggles: strap and two lenses
  b.add(loft([{ y: 0.007, rx: 0.049, rz: 0.0475, rzB: 0.054 }, { y: -0.007, rx: 0.0505, rz: 0.049, rzB: 0.056 }], { seg, region: A.get('blank'), color: L.primary }), null, { xf: { p: [0, 0.089, -0.004], r: [-0.25, 0, 0] }, crease: 0.7 });
  for (const s of [-1, 1]) {
    rod(b, A, [s * 0.02, 0.094, 0.04], [s * 0.02, 0.099, 0.058], 0.0165, 0.0155, d === 2 && fine() ? 10 : 6, mat.metal, { gloss: 0.6, crease: 0.7 });
    bead(b, A, [s * 0.02, 0.0993, 0.0592], 0.0125, mix(mat.glass, mat.white, 0.3), 6, { gloss: 1 }, [1, 1, 0.3]);
  }
}

export function scientist(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const coat = mix(mat.white, mat.paper, 0.35);
  const HL: V3 = [-0.135, 0.36, 0.13], HR: V3 = [0.135, 0.255, 0.03];
  b.group({ p: [-0.035, 0, -0.02], s: FIG }, () => {
    figure(b, A, f, { ...standPose([HL, HR]), twist: [0, -0.18, 0], head: [0.08, -0.2, 0] }, { coat: true, coatColor: coat, armband: true, seed: 91, head: scientistHead });
    // Kragen in Fraktionsfarbe, Stifte in der Brusttasche / collar in the faction colour, pens in the breast pocket
    box(b, A, [0.082, 0.016, 0.06], 0.006, {}, L.primary, { xf: { p: [0, 0.482, 0.012], r: [0.3, -0.18, 0] } });
    if (hi) for (const [x, c] of [[0.03, L.secondary], [0.042, mat.red]] as [number, ColorLike][]) box(b, A, [0.005, 0.03, 0.005], 0.001, {}, c, { xf: { p: [x, 0.422, 0.058], r: [0, -0.18, 0] }, crease: 0 });
    // Abtaststab in der linken Hand mit Saeurespitze / scanner wand in the left hand with an acid tip
    rod(b, A, [HL[0], HL[1] - 0.02, HL[2] - 0.03], [HL[0] - 0.03, HL[1] + 0.13, HL[2] + 0.16], 0.009, 0.0065, hi ? 7 : 5, mat.metal, { gloss: 0.6 });
    box(b, A, [0.034, 0.026, 0.05], 0.006, {}, mat.dark, { xf: { p: [HL[0], HL[1] - 0.01, HL[2] - 0.012] } });
    bead(b, A, [HL[0] - 0.031, HL[1] + 0.137, HL[2] + 0.168], 0.0145, mat.acid, 6, { gloss: 1 });
    // Messkoffer in der rechten Hand: Fraktionsfarbe, Metallband, Griff / instrument case in the right hand: faction colour, metal band, handle
    const cy = HR[1] - 0.115;
    caseBox(b, A, [0.05, 0.1, 0.135], L.primary, { p: [HR[0] + 0.004, cy, 0.03] });
    box(b, A, [0.053, 0.014, 0.138], 0.004, {}, mat.metal, { xf: { p: [HR[0] + 0.004, cy + 0.04, 0.03] }, gloss: 0.5 });
    box(b, A, [0.012, 0.018, 0.05], 0.004, {}, mat.dark, { xf: { p: [HR[0] + 0.004, cy + 0.058, 0.03] } });
    if (hi) emblemDecal(b, A, f, [HR[0] + 0.0295, cy - 0.016, -0.012], [1, 0, 0], 0.034, L.primary);
  });
  return b;
}

// ---------- Marines ----------

/**
 * Marines (Elite der Meridon): dunkle Marine-Kampfuniform, Gefechtshelm mit Brille, Schwimmweste in der Signalfarbe mit
 * Koppelzeug, kurzer Karabiner im Anschlag, kleiner Sturmrucksack. Breiter als der Schuetze durch Stand, Weste und
 * Gepaeck, nicht durch eine gestreckte Figur.
 * Marines (Meridon's elite): dark naval combat uniform, combat helmet with goggles, life vest in the signal colour with
 * webbing, short carbine at the ready, small assault pack. Broader than the rifleman through stance, vest and pack,
 * not through a stretched figure.
 */
export function marine(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const navy = mix(mix(L.primaryDark, mat.blue, 0.4), mat.ink, 0.48), navyDark = shade(navy, 0.72);
  const vestC = L.secondary, web = mat.darkMid;
  const G: V3 = [0.045, 0.392, 0.1], D: V3 = [-0.42, 0.02, 1];
  const pelvis: V3 = [0, 0.296, -0.01], twist: V3 = [0.03, 0.3, 0];
  b.group({ p: [0.03, 0, -0.03], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([along(G, D, 0.15), G]), pelvis,
      footL: [-0.098, ANKLE_Y, 0.075], footR: [0.098, ANKLE_Y, -0.07], bootR: [0, 0.32, 0], bootL: [0, -0.2, 0], kneePoleL: [-0.15, 0, 1],
      twist, head: [0.04, -0.3, 0], elbowPoleL: [-0.9, -0.5, 0.1], elbowPoleR: [1, -0.3, -0.2],
    }, {
      pack: 'none', seed: 57, plain: true, colors: { jacket: navy, pants: navyDark, gear: web },
      head: (hb, hA, _L, hd) => { bareHead(hb, hA, headSegments(hd)); combatHelmet(hb, hA, shade(navy, 0.92), vestC, hd, headSegments(hd)); },
    });
    rifle(b, A, G, D, { scale: 1.02, bayonet: false, scope: hi });
    // Rahmen des Oberkoerpers: Weste, Kragenwulst, Magazintaschen, Sturmrucksack / torso frame: vest, collar roll, magazine pouches, assault pack
    const T = torsoRings({ ...L, gear: web, pants: navyDark }, navy);
    b.group({ p: pelvis }, () => b.group({ r: twist }, () => {
      vest(b, A, T, hi ? 16 : 10, vestC, false);
      box(b, A, [0.124, 0.04, 0.05], 0.016, {}, shade(vestC, 0.9), { xf: { p: [0, 0.158, -0.036] } });
      for (const s of hi ? [-1, 0, 1] : [-1, 1]) {
        const q = loftAt(T, 0.5 + s * 0.075, 0.046);
        box(b, A, [0.03, 0.036, 0.018], 0.005, { pz: 'pouch' }, navyDark, { xf: { p: [q.p.x, q.p.y, q.p.z + 0.012], r: [0, s * 0.25, 0] } });
      }
      // Signalleuchte, Emblem / strobe light, emblem
      box(b, A, [0.018, 0.024, 0.012], 0.003, {}, mat.yellow, { xf: { p: [-0.046, 0.128, 0.058] } });
      if (hi) emblemDecal(b, A, f, [0.048, 0.124, 0.0585], [0.2, 0.1, 1], 0.03, vestC);
      box(b, A, [0.15, 0.125, 0.07], 0.018, { nz: 'packBack', px: 'packSide', nx: 'packSide', mirrorNx: true, py: 'packTop' }, navyDark, { xf: { p: [0, 0.1, -0.088] } }, hi ? 1 : 0);
      for (const s of [-1, 1]) box(b, A, [0.03, 0.07, 0.044], 0.008, {}, shade(navyDark, 0.9), { xf: { p: [s * 0.086, 0.09, -0.088] } });
      if (hi) b.legacy((k) => k.add(geo.torus(0.03, 0.009, 4, 10), mat.sand, { p: [0, 0.085, -0.127] }));
    }));
    // Beinholster / drop-leg holster
    box(b, A, [0.018, 0.06, 0.036], 0.005, {}, web, { xf: { p: [pelvis[0] + 0.105, pelvis[1] - 0.075, pelvis[2] - 0.02], r: [0.1, 0.3, 0.08] } });
  });
  return b;
}

// ---------- Schattenkommando / shadow commando ----------

/** Massstab des Schattenkommandos: kleiner als der Schuetze wie der Spion / scale of the shadow commando: smaller than the rifleman like the spy */
export const COMMANDO_SCALE = 0.75;
export function shadowCommando(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const grey = mix(L.primaryDark, mat.ink, 0.45);
  // tief geduckt mit grossem Sprengrucksack als Buckel / deep crouch with a big demolition pack as a hump
  const pelvis: V3 = [0, 0.205, -0.03], twist: V3 = [0.5, 0.3, 0];
  const G: V3 = [0.06, 0.285, 0.13], D: V3 = [-0.2, 0.05, 1];
  b.group({ p: [0, 0, -0.01], s: COMMANDO_SCALE }, () => {
    figure(b, A, f, {
      pelvis, twist, head: [-0.3, -0.25, 0], handL: along(G, D, 0.14), handR: G,
      footL: [-0.085, ANKLE_Y, 0.15], footR: [0.085, ANKLE_Y + 0.024, -0.14], bootR: [0.5, 0.3, 0],
      kneePoleL: [-0.3, 0.2, 1], kneePoleR: [0.3, -0.2, 1],
    }, {
      coat: true, coatColor: grey, pack: 'none', seed: 83,
      // Kapuze, Halbmaske, goldene Schlitzbrille, Halstuch in Fraktionsfarbe / hood, half mask, gold slit goggles, neckerchief in the faction colour
      head: (hb, hA, hL, hd) => {
        const seg = headSegments(hd);
        bareHead(hb, hA, seg);
        hood(hb, hA, grey, seg);
        hb.add(frontLoft([
          { y: 0.042, rx: 0.04, rz: 0.049, rzB: 0.01, c: shade(grey, 0.8) }, { y: 0.03, rx: 0.041, rz: 0.055, rzB: 0.01 }, { y: 0.014, rx: 0.034, rz: 0.048, rzB: 0.01 }, { y: 0.002, rx: 0.024, rz: 0.036, rzB: 0.01 },
        ], { seg, region: hA.get('blank') }), null, { crease: 0.5 });
        const path = [];
        for (let i = 0; i <= 6; i++) path.push(loftAt(HEAD, 0.5 - 0.105 + (i / 6) * 0.21, FACE.eye));
        hb.add(ribbon(path, 0.0068, hA.get('blank'), 0.004), mat.gold, { gloss: 0.8, crease: 0.6 });
        hb.add(loft([{ y: 0.006, rx: 0.036, rz: 0.04 }, { y: -0.022, rx: 0.042, rz: 0.046 }], { seg, region: hA.get('blank'), color: hL.primary }), null, { crease: 0.6 });
      },
    });
    rifle(b, A, G, D, { scale: 0.95, bayonet: false });
    // Schalldaempfer / suppressor
    if (hi) rod(b, A, along(G, D, 0.29), along(G, D, 0.37), 0.0125, 0.0125, 8, mat.darkMid, { gloss: 0.4, crease: 0.6 });
    // Sprengrucksack im Rahmen des Oberkoerpers, Band in Fraktionsfarbe, Kabelrolle / demolition pack in the torso frame, band in the faction colour, cable reel
    b.group({ p: pelvis }, () => b.group({ r: twist }, () => {
      b.group({ p: [0, 0.095, -0.105], r: [-0.08, 0, 0] }, () => {
        box(b, A, [0.2, 0.16, 0.11], 0.026, { nz: 'packBack', px: 'packSide', nx: 'packSide', mirrorNx: true, py: 'packTop' }, mat.darkMid, {}, hi ? 1 : 0);
        box(b, A, [0.206, 0.034, 0.116], 0.012, {}, L.primary, { xf: { p: [0, 0.04, 0] } });
        if (hi) {
          rod(b, A, [-0.034, 0.096, -0.004], [0.034, 0.096, -0.004], 0.034, 0.034, 10, mat.wood, { cell: 'tank', crease: 0.6 });
          for (const s of [-1, 1]) rod(b, A, [s * 0.034, 0.096, -0.004], [s * 0.042, 0.096, -0.004], 0.04, 0.04, 10, mat.dark, { crease: 0.6 });
          emblemDecal(b, A, f, [0, -0.03, -0.056], [0, 0, -1], 0.05, mat.darkMid);
        }
      });
      // Sprengsatz am Guertel / charge on the belt
      if (hi) {
        box(b, A, [0.05, 0.036, 0.03], 0.006, { pz: 'case' }, mat.darkMid, { xf: { p: [-0.07, 0.018, 0.056] } });
        box(b, A, [0.052, 0.009, 0.032], 0.003, {}, mat.red, { xf: { p: [-0.07, 0.04, 0.056] } });
      }
    }));
  });
  return b;
}

// ---------- Panzerabwehr-Trupp / anti-tank squad ----------

export function antiTank(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const st = styleOf(f);
  const style = f === 'vesper' ? 'cult' : st;
  // Kennform: uebergrosses dunkles Rohr auf Kopfhoehe / signature: an oversized dark tube at head height
  const r = st === 'dravon' ? 0.05 : 0.046, len = st === 'dravon' ? 0.52 : 0.5;
  const tubeC = st === 'velkar' ? L.hullDark : mix(mat.metal, mat.dark, 0.35);
  b.group({ p: [0.04, 0, -0.03], s: FIG }, () => {
    figure(b, A, f, {
      ...kneelPose([[0.07, 0.385, 0.2], [0.115, 0.37, 0.055]]),
      head: [0.15, -0.15, 0], elbowPoleL: [-0.6, -1, 0.3], elbowPoleR: [0.8, -1, 0],
    }, { detail: 0, seed: 71 });
    rocketTube(b, A, [0.128 + (r - 0.046), 0.425, 0], -0.1, { r, len, c: tubeC, band: L.secondary, style });
    // Raketenkiste mit Ersatzraketen und Emblem, eine Rakete lehnt daran. Der Ladeschuetze des alten Modells entfaellt:
    // zwei gezeichnete Figuren sprengen das Budget des Typs (bisher 7310 Dreiecke).
    // rocket crate with spares and the emblem, one rocket leaning against it. The old model's loader is gone: two
    // inked figures exceed the type's budget (7310 triangles before).
    b.group({ p: [-0.2, 0, 0.1], r: [0, 0.5, 0] }, () => {
      board(b, A, [0.2, 0.07, 0.13], mat.wood, { p: [0, 0.035, 0] });
      for (const x of hi ? [-0.055, 0, 0.055] : [-0.03, 0.03]) spareRocket(b, A, [x, 0.09, 0], 0.02, 0.13, L.hull);
      emblemDecal(b, A, f, [0, 0.036, 0.0655], [0, 0, 1], 0.046, mat.wood);
      if (hi) {
        board(b, A, [0.2, 0.012, 0.13], mat.woodLight, { p: [0, 0.07, -0.1], r: [1.15, 0, 0] });
        spareRocket(b, A, [0.135, 0.085, 0.02], 0.02, 0.13, L.hull, [-1.25, 0, 0.1]);
      }
    });
  });
  return b;
}

// ---------- Railgun-Schuetze / railgun marksman ----------

/** Schienengewehr entlang +z ab dem Griff: zwei lange Schienen, Leuchtspulen, Kondensator / rail rifle along +z from the grip: two long rails, glowing coils, capacitor */
function railRifle(b: UvBuilder, A: AtlasLayout, grip: V3, pitch: number): void {
  const hi = fine(), len = 0.5, z0 = 0.09;
  b.group({ p: grip, r: [-pitch, 0, 0] }, () => {
    box(b, A, [0.032, 0.046, 0.15], 0.008, { px: 'plate', nx: 'plate' }, TECH.gear, { xf: { p: [0, 0.004, -0.055] } });
    box(b, A, [0.044, 0.042, 0.095], 0.01, { px: 'case', nx: 'case' }, TECH.shell, { xf: { p: [0, 0.022, 0.058] }, gloss: 0.25 });
    box(b, A, [0.02, 0.046, 0.026], 0.005, {}, mat.dark, { xf: { p: [0, -0.03, 0.016], r: [0.35, 0, 0] } });
    for (const y of [0.046, 0.004]) box(b, A, [0.016, 0.011, len], 0.003, {}, TECH.gearDark, { xf: { p: [0, y, z0 + len / 2] }, gloss: 0.4 });
    box(b, A, [0.007, 0.032, len * 0.92], 0.002, {}, TECH.coil, { xf: { p: [0, 0.025, z0 + len * 0.47] }, crease: 0 });
    // Leuchtspulen um die Schienen / glowing coils around the rails
    const n = hi ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const z = z0 + 0.05 + (i / (n - 1)) * (len - 0.12);
      b.add(loft([{ y: 0.008, rx: 0.016, rz: 0.03, e: 3.2, hard: true }, { y: -0.008, rx: 0.016, rz: 0.03, e: 3.2, hard: true }], { seg: hi ? 10 : 6, region: A.get('blank'), color: TECH.glow }), null, { xf: { p: [0, 0.025, z], r: [HALF_PI, 0, 0] }, gloss: 1, crease: 0.6 });
    }
    box(b, A, [0.038, 0.064, 0.024], 0.006, {}, TECH.shell, { xf: { p: [0, 0.025, z0 + len] }, gloss: 0.25 });
    // Zielfernrohr mit Leuchtlinse, Zweibein / scope with a glowing lens, bipod
    rod(b, A, [0, 0.084, 0.03], [0, 0.084, 0.125], 0.0135, 0.0135, hi ? 10 : 6, mat.ink, { gloss: 0.5, crease: 0.6 });
    bead(b, A, [0, 0.084, 0.126], 0.0115, TECH.glow, 6, { gloss: 1 }, [1, 1, 0.3]);
    if (hi) for (const s of [-1, 1]) rod(b, A, [0, 0, 0.34], [s * 0.06, -0.2, 0.38], 0.0045, 0.0045, 4, mat.dark);
  });
}

export function railSniper(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const grip: V3 = [0.04, 0.33, 0.04];
  b.group({ p: [0.02, 0, -0.13], s: FIG }, () => {
    figure(b, A, f, { ...kneelPose([[-0.03, 0.345, 0.2], grip]), head: [0.1, 0, 0], twist: [0, 0.05, 0] }, { seed: 29 });
    railRifle(b, A, grip, 0.12);
    // Kondensator-Koffer neben dem Schuetzen mit Kabel zum Gewehr / capacitor case next to the marksman with a cable to the rifle
    {
      b.group({ p: [-0.2, 0.034, -0.17], r: [0, 0.3, 0] }, () => {
        caseBox(b, A, [0.1, 0.068, 0.14], TECH.shell);
        box(b, A, [0.04, 0.012, 0.007], 0.002, {}, TECH.glow, { xf: { p: [0.016, 0.022, 0.07] }, gloss: 1, crease: 0 });
        emblemDecal(b, A, f, [-0.026, 0.004, -0.0705], [0, 0, -1], 0.036, TECH.shell);
      });
      if (hi) {
        rod(b, A, [-0.17, 0.06, -0.17], [-0.07, 0.17, -0.1], 0.0055, 0.0055, 5, TECH.gearDark);
        rod(b, A, [-0.07, 0.17, -0.1], [0.02, 0.3, -0.03], 0.0055, 0.0055, 5, TECH.gearDark);
      }
    }
  });
  void L;
  return b;
}

// ---------- Lichtschuetzen / light wardens ----------

/** Langes Ordensgewehr: weisser Schaft mit Goldbeschlag, langer Lauf, Lichtvisier mit leuchtender Goldlinse / long Order rifle: white stock with gold fittings, long barrel, radiant scope with a glowing gold lens */
export function holyRifle(b: UvBuilder, A: AtlasLayout, grip: V3, dir: V3, len: number, rich: boolean): void {
  const hi = fine();
  b.group({ p: grip, r: aimZ(dir) }, () => {
    const stock = geo.profileZY([[-0.13, -0.034], [-0.13, 0.018], [-0.04, 0.02], [0.012, 0.016], [0.012, -0.014], [-0.058, -0.018]], 0.026);
    b.add(projectBox(stock, faces(A, { px: 'plate', nx: 'plate', mirrorNx: true })), FAITH.plate, { gloss: 0.25 });
    box(b, A, [0.029, 0.056, 0.01], 0.003, {}, FAITH.gold, { xf: { p: [0, -0.008, -0.13] }, gloss: 0.6 });
    box(b, A, [0.02, 0.046, 0.022], 0.005, {}, mat.dark, { xf: { p: [0, -0.03, 0.014], r: [-0.35, 0, 0] } });
    box(b, A, [0.034, 0.042, 0.17], 0.008, { px: 'case', nx: 'case' }, FAITH.plate, { xf: { p: [0, 0, 0.09] }, gloss: 0.25 });
    box(b, A, [0.037, 0.01, 0.15], 0.003, {}, FAITH.gold, { xf: { p: [0, -0.014, 0.094] }, gloss: 0.6 });
    // Lauf mit Goldringen und Muendung / barrel with gold rings and muzzle
    const z0 = 0.17, bl = len - z0;
    rod(b, A, [0, 0.005, z0], [0, 0.005, len], 0.0085, 0.0078, hi ? 8 : 6, mat.metal, { gloss: 0.8 });
    for (const t of hi ? [0.3, 0.62] : [0.5]) rod(b, A, [0, 0.005, z0 + bl * t - 0.006], [0, 0.005, z0 + bl * t + 0.006], 0.0125, 0.0125, 8, FAITH.gold, { gloss: 0.6, crease: 0.6 });
    rod(b, A, [0, 0.005, len - 0.024], [0, 0.005, len + 0.006], 0.012, 0.015, 8, FAITH.gold, { gloss: 0.6, crease: 0.6 });
    // Lichtvisier / radiant scope
    rod(b, A, [0, 0.046, 0.02], [0, 0.046, 0.15], 0.0145, 0.0145, hi ? 10 : 6, FAITH.plate, { gloss: 0.3, crease: 0.6 });
    rod(b, A, [0, 0.046, 0.15], [0, 0.046, 0.176], 0.016, 0.019, hi ? 10 : 6, FAITH.gold, { gloss: 0.6, crease: 0.6 });
    bead(b, A, [0, 0.046, 0.177], 0.0155, FAITH.halo, 6, { gloss: 1 }, [1, 1, 0.3]);
    for (const z of [0.05, 0.12]) box(b, A, [0.009, 0.022, 0.012], 0.002, {}, mat.dark, { xf: { p: [0, 0.027, z] } });
    if (rich) for (const s of [-1, 1]) rod(b, A, [0, -0.004, len - 0.12], [s * 0.055, -0.19, len - 0.08], 0.004, 0.004, 4, mat.dark);
  });
}

/** Weihrauchfass an der Kette mit Rauchwoelkchen; p = Aufhaengepunkt / censer on its chain with smoke puffs; p = hanging point */
export function censer(b: UvBuilder, A: AtlasLayout, p: V3, len: number): void {
  const [x, y, z] = p, cy = y - len - 0.02;
  rod(b, A, [x, y, z], [x, y - len, z], 0.0028, 0.0028, 4, FAITH.goldDark);
  b.add(loft([{ y: 0.04, rx: TIP, c: FAITH.goldLight }, { y: 0.022, rx: 0.014, hard: true }, { y: 0.022, rx: 0.02, hard: true, c: FAITH.gold }, { y: 0, rx: 0.024 }, { y: -0.02, rx: 0.016 }, { y: -0.026, rx: TIP }], { seg: fine() ? 10 : 6, region: A.get('blank') }), null, { xf: { p: [x, cy, z] }, gloss: 0.7, crease: 0.6 });
  if (fine()) for (let i = 0; i < 3; i++) bead(b, A, [x + 0.01 * i, cy + 0.058 + i * 0.034, z - 0.005 * i], 0.014 + i * 0.005, mix(mat.paper, mat.white, 0.4), 6);
}

export function lightWarden(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const hi = fine();
  const grip: V3 = [0.04, 0.335, 0.04];
  b.group({ p: [0.05, 0, -0.1], s: FIG }, () => {
    // kniender Lichtschuetze mit langem Ordensgewehr / kneeling light warden with the long Order rifle
    figure(b, A, f, { ...kneelPose([[-0.03, 0.35, 0.2], grip]), head: [0.1, 0, 0], twist: [0, 0.05, 0] }, { detail: hi ? 2 : 1, seed: 31 });
    holyRifle(b, A, grip, [0, 0.03, 1], 0.54, hi);
    {
      // Spaeher mit Fernglas und Weihrauchfass / spotter with field glasses and an incense censer
      const HR: V3 = [0.13, 0.3, 0.06], HL: V3 = [-0.05, 0.555, 0.105];
      b.group({ p: [-0.3, 0, -0.04], r: [0, 0.35, 0] }, () => {
        figure(b, A, f, { ...standPose([HL, HR]), head: [0.06, 0, 0], elbowPoleL: [-1, -0.3, 0.2] }, { detail: 0, seed: 37 });
        censer(b, A, [HR[0], HR[1] - 0.03, HR[2]], 0.07);
        for (const sx of [-1, 1]) rod(b, A, [HL[0] + 0.03 + sx * 0.012, HL[1] + 0.012, HL[2] - 0.03], [HL[0] + 0.03 + sx * 0.013, HL[1] + 0.012, HL[2] + 0.02], 0.0105, 0.012, 7, mat.dark, { crease: 0.6 });
      });
      // Sonnenkranz-Standarte: Stange, blaues Tuch mit Emblem, Goldleiste, Kranz / sun-halo standard: pole, blue cloth with the emblem, gold bar, halo
      rod(b, A, [-0.12, 0, -0.36], [-0.12, 0.655, -0.36], 0.0062, 0.0062, 5, FAITH.goldDark, { gloss: 0.5 });
      banner(b, A, 0.105, 0.15, FAITH.cloth, { p: [-0.062, 0.545, -0.36] });
      box(b, A, [0.118, 0.012, 0.012], 0.003, {}, FAITH.gold, { xf: { p: [-0.062, 0.622, -0.36] }, gloss: 0.6 });
      emblemDecal(b, A, f, [-0.062, 0.552, -0.3562], [0, 0, 1], 0.07, FAITH.cloth);
      b.legacy((k) => haloRing(k, [-0.12, 0.672, -0.36], 0.04, 0.004, 14, -0.4));
      // Munitionskiste mit Goldbeschlag / ammo case with gold fittings
      if (hi) b.group({ p: [0.19, 0, -0.06], r: [0, 0.3, 0] }, () => {
        caseBox(b, A, [0.095, 0.055, 0.06], FAITH.plate, { p: [0, 0.0275, 0] });
        box(b, A, [0.098, 0.008, 0.063], 0.002, {}, FAITH.gold, { xf: { p: [0, 0.05, 0] }, gloss: 0.6 });
      });
    }
  });
  return b;
}
