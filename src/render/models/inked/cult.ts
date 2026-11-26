/**
 * Gezeichnete Einheiten: Fusstruppen des Kults der Letzten Stunde (Eiferer, Fackeltraeger, Prophet, Berserker,
 * Panzerfaust-Eiferer). Zerlumpte Kutten mit Strick, Knochenmasken, Blutrot, Glut, Rost.
 * Inked units: foot troops of the Last Hour cult (zealot, torchbearer, prophet, berserker, rocket zealot). Ragged robes
 * with a rope, bone masks, blood red, ember, rust.
 *
 * Kennformen wie bisher: Eiferer mit Untergangsschild auf dem Ruecken, Fackeltraeger mit Flamme und zwei Tanks, Prophet
 * als Dreieck (Ornat bis zum Boden, Mitra, erhobenes Buch, Stab mit Laterne), Berserker mit nacktem Oberkoerper und zwei
 * Aexten, Panzerfaust-Eiferer kniend mit dem uebergrossen Rostrohr.
 * Signatures as before: zealot with the doom placard on the back, torchbearer with flame and two tanks, prophet as a
 * triangle (vestment to the ground, mitre, raised book, staff with lantern), berserker with a bare torso and two axes,
 * rocket zealot kneeling with the oversized rusty tube.
 */
import type { FactionId } from '../../../data/balance';
import { fine, shade, type V3 } from '../kit';
import { look, mat } from '../look';
import { ANKLE_Y, bareHead, FACE, factionHead, FIG, figure, HEAD, headSegments, kneelPose, rifle, standPose, torsoRings } from './figure';
import { along, bead, box, cell, rod, TIP } from './figkit';
import { banner, board, flame, gasTank, handAxe, lantern, rocketTube, spareRocket } from './props';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, loftAt, ribbon, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;

// ---------- Eiferer / zealot ----------

export function zealot(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const G: V3 = [0.04, 0.352, 0.092], D: V3 = [-0.3, 0.12, 1];
  b.group({ p: [0.01, 0, -0.04], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([along(G, D, 0.13), [G[0] + 0.004, G[1] - 0.012, G[2] - 0.012]]),
      twist: [0, 0.45, 0], head: [0, -0.35, 0],
      footL: [-0.052, ANKLE_Y, 0.04], footR: [0.056, ANKLE_Y, -0.036], bootR: [0, 0.35, 0],
    }, { robe: true, seed: 11 });
    rifle(b, A, G, D, { scale: 1.08 });
    // Klebeband am Gewehr / tape on the rifle
    if (hi) for (const t of [0.02, 0.19]) box(b, A, [0.03, 0.036, 0.016], 0.004, {}, mat.paper, { xf: { p: along(G, D, t), r: [0, -0.29, 0] } });
    // Untergangs-Schild auf dem Ruecken: Stange und Brett mit dem Zeichen des Kults auf beiden Seiten
    // doom placard on the back: pole and board with the cult's sign on both sides
    rod(b, A, [0.03, 0.32, -0.085], [0.05, 0.63, -0.115], 0.0075, 0.0075, 5, mat.wood);
    b.group({ p: [0.052, 0.612, -0.12], r: [-0.08, 0.2, 0.06] }, () => {
      board(b, A, [0.2, 0.13, 0.014], shade(mat.wood, 0.95));
      for (const s of [-1, 1]) emblemDecal(b, A, 'vesper', [0, 0, s * 0.007], [0, 0, s], 0.1, shade(mat.wood, 0.95));
    });
    // Handglocke am Strick / hand bell on a cord
    rod(b, A, [-0.09, 0.335, 0.03], [-0.094, 0.27, 0.036], 0.0025, 0.0025, 4, mat.wood);
    b.add(loft([{ y: 0.02, rx: TIP, c: mat.gold }, { y: 0.016, rx: 0.011 }, { y: 0, rx: 0.016 }, { y: -0.012, rx: 0.021, hard: true }, { y: -0.012, rx: 0.014, c: shade(mat.gold, 0.5) }], { seg: hi ? 10 : 6, region: A.get('blank') }), null, { xf: { p: [-0.094, 0.258, 0.036] }, gloss: 0.8, crease: 0.6 });
  });
  void L;
  return b;
}

// ---------- Fackeltraeger / torchbearer ----------

export function torchbearer(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const G: V3 = [0.05, 0.34, 0.1], D: V3 = [-0.12, 0.02, 1];
  b.group({ p: [0, 0, -0.13], s: FIG }, () => {
    figure(b, A, f, {
      ...standPose([along(G, D, 0.15), G]),
      footL: [-0.052, ANKLE_Y, 0.04], footR: [0.056, ANKLE_Y, -0.036], twist: [0, 0.25, 0], head: [0, -0.2, 0],
    }, { robe: true, seed: 21 });
    // Flammenwerfer: Rohr, Ventilblock, Duese, Flamme / flamethrower: wand, valve block, nozzle, flame
    const back = along(G, D, -0.09), tip = along(G, D, 0.27);
    rod(b, A, back, tip, 0.012, 0.011, hi ? 8 : 6, mat.rust, { cell: 'tank', gloss: 0.3 });
    box(b, A, [0.034, 0.04, 0.1], 0.008, { all: 'plate' }, mat.rustDark, { xf: { p: along(G, D, 0.03), r: [0, -0.12, 0] } });
    rod(b, A, tip, along(G, D, 0.305), 0.017, 0.015, hi ? 8 : 6, mat.dark, { gloss: 0.4, crease: 0.6 });
    flame(b, A, along(G, D, 0.305), D, 0.17);
    // zwei rostige Tanks auf dem Ruecken mit Glutband, Tragegurt / two rusty tanks on the back with an ember band, harness
    for (const sx of [-1, 1]) gasTank(b, A, [sx * 0.036, 0.345, -0.09], 0.031, 0.15, sx > 0 ? mat.rust : L.primaryDark, mat.ember);
    box(b, A, [0.14, 0.014, 0.014], 0.003, {}, mat.dark, { xf: { p: [0, 0.46, -0.058] } });
    // Schlauch vom Tank zum Rohr / hose from the tank to the wand
    const hose: V3[] = [[0.04, 0.35, -0.1], [0.11, 0.3, -0.05], [0.115, 0.31, 0.03], back];
    for (let i = 0; i < hose.length - 1; i++) rod(b, A, hose[i], hose[i + 1], 0.0075, 0.0075, 5, mat.dark);
    // Gasmasken-Filter vor dem Gesicht / gas mask filter in front of the face
    rod(b, A, [0.004, 0.512, 0.066], [0.008, 0.507, 0.1], 0.016, 0.018, hi ? 8 : 6, mat.rustDark, { cell: 'tank', crease: 0.6 });
    rod(b, A, [0.008, 0.507, 0.1], [0.0085, 0.5065, 0.106], 0.012, 0.012, 6, mat.dark);
  });
  return b;
}

// ---------- Prophet ----------

/** Ornat des Propheten: Glocke von der Brust bis zum Boden (Baugroesse, oben nach unten) / the prophet's vestment: a bell from the chest to the ground (build size, top to bottom) */
export function vestmentRings(L: ReturnType<typeof look>): Ring[] {
  const c = shade(L.primary, 0.78), e = 2.6;
  return [
    { y: 0.372, rx: 0.06, rz: 0.04, c, e },
    { y: 0.35, rx: 0.088, rz: 0.062, e },
    { y: 0.22, rx: 0.112, rz: 0.088, e },
    { y: 0.085, rx: 0.136, rz: 0.11, e, hard: true },
    { y: 0.084, rx: 0.138, rz: 0.112, e, hard: true, c: mat.ember },
    { y: 0.056, rx: 0.141, rz: 0.115, e, hard: true },
    { y: 0.055, rx: 0.14, rz: 0.114, e, hard: true, c },
    { y: 0.012, rx: 0.147, rz: 0.12, e, hard: true },
    { y: 0.012, rx: 0.12, rz: 0.1, e, c: shade(c, 0.4) },
  ];
}
export const VESTMENT = { top: 0.372, bottom: 0.012 };

export function prophet(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  // der Prophet ist kleiner gebaut, damit Mitra und Stab unter dem Lebensbalken bleiben / the prophet is built smaller so mitre and staff stay below the HP badge
  const S = 0.835;
  const book: V3 = [-0.125, 0.615, 0.07], staff: V3 = [0.145, 0.4, 0.06];
  b.group({ p: [0, 0, -0.01], s: S }, () => {
    figure(b, A, f, { ...standPose([book, staff]), head: [-0.25, 0, 0.1], elbowPoleL: [-1, 0.2, 0.3] }, {
      robe: true, seed: 31,
      // Mitra auf der Kopfbedeckung der Fraktion / mitre on top of the faction's headgear
      head: (hb, hA, hL, hd) => {
        factionHead(hb, hA, f, hL, hd, headSegments(hd), false, 31);
        hb.add(loft([
          { y: 0.198, rx: TIP, c: L.primary }, { y: 0.193, rx: 0.011, rz: 0.008 }, { y: 0.163, rx: 0.033, rz: 0.021, e: 3 }, { y: 0.134, rx: 0.042, rz: 0.03, e: 3, hard: true },
          { y: 0.1335, rx: 0.0435, rz: 0.0315, e: 3, hard: true, c: mat.ember }, { y: 0.121, rx: 0.044, rz: 0.033, e: 3, hard: true }, { y: 0.121, rx: 0.03, rz: 0.022, c: shade(L.primary, 0.4) },
        ], { seg: hi ? 14 : 8, region: cell(hA, 'cloth') }), null, { xf: { p: [0, 0, -0.012] } });
        emblemDecal(hb, hA, 'vesper', [0, 0.156, 0.011], [0, 0.25, 1], 0.03, L.primary);
      },
    });
    // weites Ornat bis zum Boden mit Glutsaum / wide vestment down to the ground with an ember hem
    b.add(loft(vestmentRings(L), { seg: hi ? 20 : 10, region: cell(A, 'vestment:vesper', 'cloth') }), null, { xf: { p: [0, 0, -0.004] }, crease: 0.8 });
    // rote Stola ueber der Brust / red stole across the chest
    for (const sx of [-1, 1]) {
      box(b, A, [0.026, 0.13, 0.008], 0.003, {}, L.primary, { xf: { p: [sx * 0.036, 0.415, 0.056], r: [-0.06, 0, sx * 0.05] } });
      box(b, A, [0.03, 0.016, 0.011], 0.003, {}, mat.ember, { xf: { p: [sx * 0.04, 0.356, 0.063] } });
    }
    // Stab mit Glutlaterne / staff with an ember lantern
    rod(b, A, [0.155, 0, 0.075], [0.143, 0.7, 0.05], 0.0095, 0.0085, hi ? 7 : 5, mat.wood);
    rod(b, A, [0.143, 0.7, 0.05], [0.185, 0.725, 0.05], 0.007, 0.006, 5, mat.wood);
    rod(b, A, [0.185, 0.725, 0.05], [0.185, 0.69, 0.05], 0.0024, 0.0024, 4, mat.dark);
    lantern(b, A, [0.185, 0.6, 0.05], 1.55);
    // heiliges Buch in der erhobenen Hand / holy book in the raised hand
    b.group({ p: [book[0], book[1] + 0.04, book[2] + 0.01], r: [-1.2, 0.3, 0] }, () => {
      box(b, A, [0.118, 0.024, 0.09], 0.005, {}, L.primaryDark);
      box(b, A, [0.108, 0.019, 0.082], 0.003, {}, mat.bone, { xf: { p: [0, 0.004, 0] } });
      box(b, A, [0.015, 0.027, 0.094], 0.003, {}, mat.ember);
      if (hi) for (const sx of [-1, 1]) box(b, A, [0.007, 0.028, 0.014], 0.002, {}, mat.gold, { xf: { p: [sx * 0.06, 0, 0.024] }, gloss: 0.7 });
    });
  });
  return b;
}

// ---------- Berserker ----------

export function berserker(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const paint = L.primary;
  const pelvis: V3 = [0, 0.262, 0], twist: V3 = [0, -0.28, 0];
  // breitbeiniger Sturmlauf, rechte Axt hoch ueber dem Kopf, linke vorgestreckt / wide-legged charge, right axe high above the head, left one thrust forward
  const handR: V3 = [0.175, 0.5, -0.01], handL: V3 = [-0.15, 0.37, 0.17];
  b.group({ p: [0, 0, -0.03], s: FIG }, () => {
    figure(b, A, f, {
      pelvis, twist, head: [0.12, 0.25, 0], handL, handR,
      footL: [-0.092, ANKLE_Y, 0.115], footR: [0.096, ANKLE_Y, -0.1], bootR: [0, 0.4, 0], bootL: [0, -0.2, 0],
      elbowPoleR: [1, -0.2, -0.4], elbowPoleL: [-0.8, -0.8, 0.2],
    }, {
      detail: hi ? 2 : 1, bare: true, plain: true, seed: 57,
      // wilde Maehne, Kriegsbemalung neben den Augen, Bart / wild mane, war paint beside the eyes, beard
      head: (hb, hA, HL, hd) => {
        const seg = headSegments(hd);
        bareHead(hb, hA, seg);
        // Maehne: bedeckt den Schaedel, faellt in den Nacken; vorn bleibt das Gesicht frei / mane: covers the skull, falls onto the nape; the face stays open in front
        hb.add(loft([
          { y: 0.12, rx: TIP, c: mat.dark }, { y: 0.115, rx: 0.026 }, { y: 0.101, rx: 0.045, rzB: 0.05 }, { y: 0.083, rx: 0.0505, rzB: 0.057 },
          { y: 0.07, rx: 0.051, rz: 0.047, rzB: 0.058, hard: true }, { y: 0.058, rx: 0.05, rz: 0.012, rzB: 0.06 }, { y: 0.025, rx: 0.049, rz: 0.006, rzB: 0.062 },
          { y: -0.005, rx: 0.044, rz: 0.004, rzB: 0.058 }, { y: -0.03, rx: TIP, cz: -0.04 },
        ], { seg, region: hA.get('blank') }), null, { xf: { p: [0, 0, -0.005] }, crease: 0.6 });
        const spikes = hd >= 2 ? 6 : 4;
        for (let i = 0; i < spikes; i++) {
          const a = (i / (spikes - 1) - 0.5) * 2.2;
          hb.add(loft([{ y: 0, rx: 0.016 }, { y: 0.05 + (i % 2) * 0.012, rx: TIP }], { seg: 5, region: hA.get('blank'), color: mat.dark }), null, { xf: { p: [Math.sin(a) * 0.036, 0.106, -0.012 - Math.cos(a) * 0.014], r: [-0.55 - (i % 3) * 0.14, 0, -a * 0.65] }, crease: 0.5 });
        }
        // Bemalung: Streifen an den Schlaefen und unter den Augen (die Augen bleiben frei)
        // paint: stripes at the temples and below the eyes (the eyes stay clear)
        for (const s of [-1, 1]) {
          const temple = [0, 1, 2, 3].map((i) => loftAt(HEAD, 0.5 + s * (0.118 + i * 0.027), FACE.eye + 0.001));
          hb.add(ribbon(temple, 0.008, hA.get('blank'), 0.0012), HL.primary, { crease: 0 });
          if (hd >= 2) {
            const streak = [0, 1, 2].map((i) => loftAt(HEAD, 0.5 + s * 0.085, 0.041 - i * 0.011));
            hb.add(ribbon(streak, 0.0038, hA.get('blank'), 0.0012), HL.primary, { crease: 0 });
          }
        }
        // Bart / beard
        hb.add(loft([{ y: 0.012, rx: 0.03, rz: 0.012, c: mat.dark }, { y: 0, rx: 0.031, rz: 0.02 }, { y: -0.022, rx: 0.022, rz: 0.016 }, { y: -0.05, rx: TIP }], { seg: hd >= 2 ? 8 : 6, region: hA.get('blank') }), null, { xf: { p: [0, 0.008, 0.03], r: [0.3, 0, 0] }, crease: 0.5 });
      },
    });
    // Rahmen des Oberkoerpers: Bemalung, Kultzeichen, Riemen mit Ladungen / torso frame: paint, cult sign, strap with charges
    const T = torsoRings(L, mat.skin, true);
    b.group({ p: pelvis }, () => b.group({ r: twist }, () => {
      for (let i = 0; i < 3; i++) {
        const path = [0, 1, 2, 3].map((k) => loftAt(T, 0.5 - 0.075 + i * 0.05 + k * 0.014, 0.132 - k * 0.022));
        b.add(ribbon(path, 0.0052, A.get('blank'), 0.0014), paint, { crease: 0 });
      }
      const back = loftAt(T, 0.002, 0.105);
      emblemDecal(b, A, 'vesper', [back.p.x, back.p.y, back.p.z], [0, 0, -1], 0.075, mat.skin);
      // Schulterriemen / shoulder strap
      const n = hi ? 12 : 6;
      const strap = [];
      for (let i = 0; i <= n; i++) { const u = i / n; strap.push(loftAt(T, 0.36 + u * 0.3, 0.148 - u * 0.108)); }
      b.add(ribbon(strap, 0.0105, cell(A, 'strap'), 0.002), mat.dark);
      for (let i = 0; i < (hi ? 3 : 2); i++) {
        const q = loftAt(T, 0.42 + i * 0.075, 0.128 - i * 0.03);
        box(b, A, [0.024, 0.032, 0.018], 0.004, {}, i % 2 ? mat.rust : paint, { xf: { p: [q.p.x, q.p.y, q.p.z + 0.008], r: [0, 0, -0.62] } });
      }
    }));
    // Sprenggurt: Stangen um die Huefte, Zuender mit Glut, Draehte / explosive belt: sticks around the hips, detonator with ember, wires
    b.group({ p: [pelvis[0], pelvis[1] + 0.016, pelvis[2]] }, () => {
      const n = hi ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = ((i - (n - 1) / 2) / n) * Math.PI * 1.75;
        const p: V3 = [Math.sin(a) * 0.083, -0.004, Math.cos(a) * 0.062];
        rod(b, A, [p[0], p[1] - 0.034, p[2]], [p[0], p[1] + 0.034, p[2]], 0.0125, 0.0125, hi ? 7 : 5, paint, { crease: 0.6 });
        if (hi) rod(b, A, [p[0], p[1] + 0.034, p[2]], [p[0], p[1] + 0.046, p[2]], 0.004, 0.004, 4, mat.dark);
      }
      box(b, A, [0.044, 0.034, 0.022], 0.005, { pz: 'case' }, mat.gunmetal, { xf: { p: [0.024, 0.012, 0.072] } });
      bead(b, A, [0.03, 0.022, 0.085], 0.006, mat.ember, 5);
      if (hi) {
        rod(b, A, [0.004, 0.02, 0.076], [-0.05, 0.036, 0.06], 0.0026, 0.0026, 4, mat.red);
        rod(b, A, [0.044, 0.02, 0.074], [0.072, 0.036, 0.046], 0.0026, 0.0026, 4, mat.yellow);
      }
    });
    // zwei Handaexte / two hand axes
    handAxe(b, A, handR, [0.4, 0.8, 0.3], 0.17, 1.0);
    handAxe(b, A, handL, [-0.25, 0.5, 1], 0.19, -1.2);
  });
  return b;
}

// ---------- Panzerfaust-Eiferer / rocket zealot ----------

export function faustZealot(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f);
  const hi = fine();
  const tube: V3 = [0.128, 0.425, 0.0];
  b.group({ p: [0.0, 0, -0.03], s: FIG }, () => {
    figure(b, A, f, {
      ...kneelPose([[0.07, 0.385, 0.2], [0.115, 0.37, 0.055]]),
      head: [0.15, -0.15, 0], elbowPoleL: [-0.6, -1, 0.3], elbowPoleR: [0.8, -1, 0],
    }, { detail: hi ? 2 : 1, robe: true, hem: -0.165, seed: 91 });
    // uebergrosses Rostrohr auf der Schulter (Kennform gegen die anderen Kuttentraeger) / oversized rusty tube on the shoulder (signature against the other robed units)
    rocketTube(b, A, tube, -0.12, { r: 0.045, len: 0.5, c: mat.rust, band: L.primary, style: 'cult' });
    // Buendel Ersatzraketen am Strick / bundle of spare rockets on a cord
    b.group({ p: [-0.2, 0, -0.17], r: [0, 0.5, 0] }, () => {
      for (let i = 0; i < (hi ? 3 : 2); i++) spareRocket(b, A, [(i - 1) * 0.042, 0.12, 0], 0.017, 0.2, mat.rustDark, [-HALF_PI, 0, 0], i % 2 ? mat.ember : mat.rust);
      box(b, A, [0.14, 0.018, 0.045], 0.004, {}, mat.sand, { xf: { p: [0, 0.09, 0] } });
      if (hi) box(b, A, [0.14, 0.012, 0.045], 0.004, {}, mat.sand, { xf: { p: [0, 0.16, 0] } });
    });
    // Weltuntergangs-Banner / doom banner
    if (hi) {
      rod(b, A, [-0.08, 0, -0.27], [-0.09, 0.68, -0.29], 0.007, 0.006, 5, mat.wood);
      b.group({ p: [-0.092, 0.59, -0.225], r: [0, HALF_PI, 0] }, () => {
        banner(b, A, 0.12, 0.16, L.primary);
        for (const s of [-1, 1]) emblemDecal(b, A, 'vesper', [0, 0.01, s * 0.004], [0, 0, s], 0.07, L.primary);
      });
    }
  });
  return b;
}
