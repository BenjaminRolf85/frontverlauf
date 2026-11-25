/**
 * Endgegner der Kampagne: Schwarmmutter Xyl'Tharra (Zyrr), etwa doppelte Einheitengroesse, schwebend.
 * Stachelkrone, Cyborg-Platte mit rotem Auge, violetter Chitinpanzer, Lichtring hinter dem Kopf, Tentakel statt Beinen.
 * Nach dem Anfuehrer-Bild (public/leaders/img/zyrr_neutral.webp) und der Anfuehrer-Bueste (leaders.ts).
 * Campaign boss: Swarm Mother Xyl'Tharra (Zyrr), about twice unit size, floating.
 * Spiked crown, cyborg plate with a red eye, violet chitin carapace, light ring behind the head, tendrils instead of legs.
 * After the leader art (public/leaders/img/zyrr_neutral.webp) and the leader bust (leaders.ts).
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import type { FactionId } from '../../data/balance';
import { Builder, fine, geo, mix, shade, type ColorLike, type V3 } from './kit';
import { bez, boltRing, cable, lerpV, rivetRow } from './detailFleet';
import { look, mat } from './look';
import { tendril } from './xeno';

const HALF_PI = Math.PI / 2;

/** Gebogener Stachel: Kegel von root in Richtung dir / curved spike: cone from root along dir */
function spike(b: Builder, root: V3, dir: V3, len: number, r: number, c: ColorLike) {
  const d = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const n: V3 = [dir[0] / d, dir[1] / d, dir[2] / d];
  b.tube(root, [root[0] + n[0] * len * 0.55, root[1] + n[1] * len * 0.55, root[2] + n[2] * len * 0.55], r, 6, c, r * 0.55);
  b.tube([root[0] + n[0] * len * 0.55, root[1] + n[1] * len * 0.55, root[2] + n[2] * len * 0.55], [root[0] + n[0] * len, root[1] + n[1] * len, root[2] + n[2] * len], r * 0.55, 6, c, 0.002);
}

/**
 * Schwarmmutter, Hoehe etwa 1.0 (Einheiten etwa 0.3 bis 0.5), Schwebehoehe der Tentakelspitzen etwa 0.03.
 * Swarm Mother, about 1.0 tall (units about 0.3 to 0.5), tendril tips hover at about 0.03.
 */
export function swarmMother(f: FactionId): Builder {
  const b = new Builder();
  // alles 1.3-fach: deutlich groesser als jede Einheit / everything 1.3 times: clearly larger than any unit
  b.group({ s: 1.3 }, () => mother(b, f));
  return b;
}

function mother(b: Builder, f: FactionId) {
  const L = look(f);
  const violet = L.primary, violetDark = shade(L.primary, 0.55), violetLight = shade(L.primary, 1.25);
  const skin = mix(mat.alienSkin, violetLight, 0.2), skinDark = shade(skin, 0.7);
  const gold = mix(mat.gold, mat.white, 0.15), metal = mat.metalLight;
  const glow = mat.xenoGlow, acid = mat.acid;
  // hohe Qualitaet: glattere Tentakel und Segmente, Zusatzteile in motherRich / high quality: smoother tendrils and segments, extra parts in motherRich
  const hi = fine();
  // ---- psychischer Ring unter ihr (zeigt das Schweben) / psychic ring below her (shows the hovering) ----
  b.add(geo.torus(0.3, 0.008, 4, 40), glow, { p: [0, 0.03, 0], r: [HALF_PI, 0, 0] });
  b.add(geo.torus(0.2, 0.006, 4, 32), acid, { p: [0, 0.05, 0], r: [HALF_PI, 0, 0] });
  // ---- Tentakel / tendrils ----
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const r0 = 0.09, r1 = 0.26 + (i % 3) * 0.05;
    const root: V3 = [Math.sin(a) * r0, 0.33, Math.cos(a) * r0];
    const mid: V3 = [Math.sin(a + 0.35) * (r1 * 0.9), 0.22, Math.cos(a + 0.35) * (r1 * 0.9)];
    const tip: V3 = [Math.sin(a + 0.6) * r1, 0.05 + (i % 2) * 0.04, Math.cos(a + 0.6) * r1];
    tendril(b, root, mid, tip, 0.03, 0.007, hi ? 11 : 7, i % 2 ? skinDark : violetDark, i % 3 ? glow : acid);
  }
  // ---- Hinterleib: gestapelte Chitinsegmente / abdomen: stacked chitin segments ----
  const segs: [number, number, number][] = [[0.3, 0.1, 0.13], [0.36, 0.15, 0.17], [0.43, 0.18, 0.19], [0.5, 0.17, 0.18]];
  segs.forEach(([y, rb, rt], i) => {
    b.cyl(rt, rb, 0.075, hi ? 26 : 18, i % 2 ? violetDark : violet, [0, y, 0]);
    b.add(geo.torus(rt + 0.004, 0.006, 4, hi ? 36 : 24), i === 3 ? gold : acid, { p: [0, y + 0.036, 0], r: [HALF_PI, 0, 0] });
    if (i > 0) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + i * 0.4;
      spike(b, [Math.sin(a) * rt, y + 0.02, Math.cos(a) * rt], [Math.sin(a), 0.5, Math.cos(a)], 0.05 + i * 0.01, 0.012, violetLight);
    }
  });
  // ---- Brustpanzer / chest carapace ----
  b.add(geo.rtaper(0.3, 0.2, 0.42, 0.24, 0.22, 0.04), violet, { p: [0, 0.65, 0] });
  b.add(geo.rtaper(0.22, 0.04, 0.3, 0.05, 0.18, 0.015), violetDark, { p: [0, 0.65, 0.11] });
  // Rippen und leuchtende Adern / ribs and glowing veins
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    b.add(geo.rtaper(0.07, 0.02, 0.09, 0.02, 0.025, 0.008), violetLight, { p: [s * 0.1, 0.57 + i * 0.04, 0.125], r: [0, 0, s * (0.35 - i * 0.05)] });
  }
  // Herzscheibe in der Brust / heart disc in the chest
  b.cyl(0.07, 0.07, 0.02, 24, gold, [0, 0.66, 0.135], [HALF_PI, 0, 0]);
  b.cyl(0.05, 0.05, 0.024, 24, glow, [0, 0.66, 0.138], [HALF_PI, 0, 0]);
  b.add(geo.sphere(0.022, 10, 6), mix(glow, mat.white, 0.6), { p: [0, 0.66, 0.15] });
  // ---- Schulterplatten mit Stacheln / shoulder plates with spikes ----
  for (const s of [-1, 1]) {
    b.add(geo.sphere(0.11, hi ? 22 : 14, hi ? 14 : 8), violet, { p: [s * 0.22, 0.75, 0], s: [1.2, 0.7, 1.1] });
    b.add(geo.torus(0.1, 0.008, 4, 20), gold, { p: [s * 0.22, 0.73, 0], r: [HALF_PI, 0, 0], s: [1.25, 1.1, 1] });
    for (let k = 0; k < 3; k++) spike(b, [s * (0.26 + k * 0.03), 0.79, -0.04 + k * 0.04], [s * (0.9 - k * 0.2), 1, -0.2], 0.16 - k * 0.03, 0.022, k === 1 ? gold : violetLight);
  }
  // Rueckenklingen fuer die Silhouette / back blades for the silhouette
  for (const s of [-1, 1]) {
    tendril(b, [s * 0.1, 0.68, -0.1], [s * 0.26, 0.92, -0.2], [s * 0.34, 1.06, -0.16], 0.03, 0.004, 8, violetDark, acid);
  }
  // ---- Arme mit Klauen und psychischen Kugeln / arms with claws and psychic orbs ----
  for (const s of [-1, 1]) {
    const sh: V3 = [s * 0.25, 0.7, 0.02];
    const el: V3 = [s * 0.36, 0.56, 0.1];
    const hand: V3 = [s * 0.33, 0.62, 0.24];
    b.tube(sh, el, 0.032, hi ? 14 : 10, violetDark, 0.026);
    b.add(geo.sphere(0.03, 10, 6), gold, { p: el });
    b.tube(el, hand, 0.026, hi ? 14 : 10, skin, 0.018);
    b.add(geo.sphere(0.024, 10, 6), skin, { p: hand });
    for (const a of [-0.6, 0, 0.6]) spike(b, hand, [Math.sin(a) * 0.6 + s * 0.1, 0.4, 1], 0.07, 0.008, skinDark);
    b.add(geo.ico(0.045, 1), glow, { p: [hand[0], hand[1] + 0.07, hand[2] + 0.03] });
    b.add(geo.torus(0.06, 0.005, 3, 18), acid, { p: [hand[0], hand[1] + 0.07, hand[2] + 0.03], r: [0.6, s * 0.4, 0] });
  }
  // Kopf groesser als die Bueste, damit Krone und Augen lesbar bleiben (um den Kopfmittelpunkt skaliert)
  // head larger than the bust so crown and eyes stay readable (scaled around the head centre)
  const HS = 1.35;
  b.group({ p: [0, 0.9 * (1 - HS), 0.02 * (1 - HS)], s: HS }, () => {
    // ---- Hals und Kopf / neck and head ----
    b.tube([0, 0.74, 0], [0, 0.82, 0.01], 0.045, 12, skin, 0.04);
    for (let i = 0; i < 3; i++) b.add(geo.torus(0.046 - i * 0.002, 0.005, 3, 16), skinDark, { p: [0, 0.76 + i * 0.022, 0.006], r: [HALF_PI, 0, 0] });
    const H: V3 = [0, 0.9, 0.02];
    b.add(geo.sphere(0.112, 22, 16), skin, { p: H, s: [0.88, 1.12, 0.92] });
    // langer Hinterkopf / elongated back of the head
    b.add(geo.sphere(0.09, 18, 12), skin, { p: [0, 0.95, -0.05], s: [0.85, 0.9, 1.2] });
    // Kinn und Wangen / chin and cheeks
    b.add(geo.cone(0.05, 0.07, 12), skin, { p: [0, 0.8, 0.05], r: [Math.PI, 0, 0] });
    // linkes Auge: magenta leuchtend / left eye: glowing magenta
    b.add(geo.sphere(0.036, 16, 10), mix(glow, mat.red, 0.25), { p: [-0.042, 0.905, 0.095], s: [1.2, 0.6, 0.5], r: [0, -0.3, -0.35] });
    b.add(geo.sphere(0.008, 8, 6), mat.white, { p: [-0.038, 0.91, 0.108] });
    // Brauenwulst / brow ridge
    b.add(geo.rtaper(0.07, 0.02, 0.05, 0.02, 0.018, 0.006), skinDark, { p: [-0.04, 0.935, 0.09], r: [0.2, -0.3, -0.25] });
    // rechte Seite: Cyborg-Platte mit rotem Auge / right side: cyborg plate with a red eye
    b.add(geo.rtaper(0.055, 0.035, 0.05, 0.03, 0.085, 0.01), metal, { p: [0.058, 0.905, 0.086], r: [0, 0.5, 0] });
    b.add(geo.torus(0.026, 0.006, 4, 18), mat.dark, { p: [0.052, 0.905, 0.104], r: [0, 0.45, 0] });
    b.add(geo.sphere(0.022, 14, 10), shade(mat.red, 1.25), { p: [0.052, 0.905, 0.104], s: [1, 1, 0.6], r: [0, 0.45, 0] });
    b.add(geo.sphere(0.008, 8, 6), mix(mat.red, mat.white, 0.7), { p: [0.05, 0.91, 0.116] });
    for (let i = 0; i < 3; i++) b.box(0.004, 0.004, 0.03, mat.dark, [0.075, 0.86 + i * 0.03, 0.06], [0, 0.45, 0]);
    // Mund / mouth
    b.box(0.04, 0.006, 0.01, shade(violet, 0.45), [0, 0.835, 0.1]);
    // Stirnzeichen / forehead mark
    b.add(geo.cone(0.012, 0.05, 4), acid, { p: [0, 0.97, 0.088], r: [0.25, 0, 0] });
    // ---- Stachelkrone / spiked crown ----
    for (let i = 0; i < 11; i++) {
      const a = -1.45 + (i / 10) * 2.9;
      const len = 0.12 + (1 - Math.abs(a) / 1.45) * 0.14;
      const root: V3 = [Math.sin(a) * 0.075, 0.98, Math.cos(a) * 0.05 - 0.01];
      spike(b, root, [Math.sin(a) * 0.7, 1, Math.cos(a) * 0.15 - 0.35], len, 0.024, i % 2 ? gold : violetLight);
      if (i % 2 === 0) b.add(geo.ico(0.012, 0), glow, { p: [root[0], root[1] + 0.012, root[2] + 0.01] });
    }
    b.add(geo.torus(0.08, 0.012, 4, 24), gold, { p: [0, 0.975, -0.005], r: [HALF_PI - 0.25, 0, 0] });
    // ---- Lichtring hinter dem Kopf / light ring behind the head ----
    b.add(geo.torus(0.21, 0.01, 4, 48), glow, { p: [0, 0.92, -0.12] });
    b.add(geo.torus(0.25, 0.005, 3, 48), acid, { p: [0, 0.92, -0.14] });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.box(0.03, 0.012, 0.012, glow, [Math.cos(a) * 0.25, 0.92 + Math.sin(a) * 0.25, -0.14], [0, 0, a]);
    }
    if (hi) headRich(b, skinDark, gold, metal, glow, acid, violet);
  });
  if (hi) motherRich(b, violet, violetDark, violetLight, skinDark, gold, glow, acid);
}

/**
 * Kopf der Schwarmmutter bei hoher Qualitaet: Zaehne, Wangenwuelste, Schrauben und Kabel an der Cyborg-Platte, Leuchtring
 * um das Auge, Edelsteine in der Krone, Knoten im Lichtring. / Swarm Mother's head on high quality: teeth, cheek ridges,
 * screws and cables on the cyborg plate, a glow ring around the eye, gems in the crown, nodes in the light ring.
 */
function headRich(b: Builder, skinDark: ColorLike, gold: ColorLike, metal: ColorLike, glow: ColorLike, acid: ColorLike, violet: ColorLike) {
  // Zaehne im Mund / teeth in the mouth
  for (let i = 0; i < 6; i++) b.add(geo.cone(0.003, 0.009, 4), mat.bone, { p: [-0.015 + i * 0.006, 0.839, 0.104], r: [Math.PI, 0, 0] });
  // Wangenwuelste / cheek ridges
  for (const sx of [-1, 1]) b.add(geo.rtaper(0.03, 0.012, 0.02, 0.01, 0.05, 0.004), skinDark, { p: [sx * 0.072, 0.865, 0.07], r: [0.2, sx * 0.6, sx * 0.25] });
  // Cyborg-Platte: Schrauben, Kabel zum Hals, Leuchtring um das Auge / cyborg plate: screws, cables to the neck, glow ring around the eye
  for (const [y, z] of [[0.94, 0.08], [0.87, 0.08], [0.94, 0.1], [0.87, 0.1]] as [number, number][]) b.box(0.006, 0.006, 0.006, mat.dark, [0.074, y, z]);
  for (const dx of [0, 0.01]) cable(b, [[0.07 + dx, 0.865, 0.06], [0.072 + dx, 0.83, 0.03], [0.05 + dx, 0.79, 0.02]], 0.0035, dx ? acid : mat.dark);
  b.add(geo.torus(0.031, 0.003, 3, 18), glow, { p: [0.052, 0.905, 0.106], r: [0, 0.45, 0] });
  b.add(geo.rbox(0.03, 0.012, 0.02, 0.004), metal, { p: [0.065, 0.95, 0.07], r: [0, 0.5, 0.2] });
  // Brauen-Leuchtlinien und Schlaefenadern / brow glow lines and temple veins
  for (const sx of [-1, 1]) cable(b, [[sx * 0.03, 0.97, 0.08], [sx * 0.07, 0.99, 0.04], [sx * 0.085, 0.97, -0.01]], 0.003, acid);
  // Edelsteine in der Krone / gems in the crown
  for (let i = 0; i < 6; i++) {
    const a = -1.3 + (i / 5) * 2.6;
    b.add(geo.ico(0.009, 0), i % 2 ? glow : mix(mat.red, violet, 0.3), { p: [Math.sin(a) * 0.083, 0.975, Math.cos(a) * 0.058 - 0.012] });
  }
  // Knoten im Lichtring / nodes in the light ring
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + 0.2;
    b.add(geo.sphere(0.007, 6, 4), k % 2 ? gold : acid, { p: [Math.cos(a) * 0.21, 0.92 + Math.sin(a) * 0.21, -0.12] });
  }
}

/**
 * Koerper der Schwarmmutter bei hoher Qualitaet: leuchtende Adern ueber Brust und Hinterleib, Plattenfugen und Nieten am
 * Brustpanzer, Rueckenstacheln, Armbaender und Klauenringe, Gelenkkugeln an den Tentakeln, Partikel im psychischen Ring.
 * Swarm Mother's body on high quality: glowing veins over the chest and abdomen, plate seams and rivets on the carapace,
 * dorsal spikes, arm bands and claw rings, joint orbs on the tendrils, particles in the psychic ring.
 */
function motherRich(b: Builder, violet: ColorLike, violetDark: ColorLike, violetLight: ColorLike, skinDark: ColorLike, gold: ColorLike, glow: ColorLike, acid: ColorLike) {
  // leuchtende Adern ueber den Brustpanzer / glowing veins over the carapace
  for (const sx of [-1, 1]) {
    cable(b, bez([sx * 0.04, 0.58, 0.125], [sx * 0.13, 0.64, 0.13], [sx * 0.17, 0.74, 0.1], 5), 0.004, acid, 4);
    cable(b, bez([sx * 0.06, 0.7, 0.13], [sx * 0.1, 0.75, 0.12], [sx * 0.08, 0.76, 0.1], 3), 0.003, glow, 4);
  }
  // Plattenfugen und Nieten am Brustpanzer / plate seams and rivets on the carapace
  for (const sx of [-1, 1]) {
    b.box(0.004, 0.18, 0.006, violetDark, [sx * 0.165, 0.65, 0.07], [0, 0, sx * -0.25]);
    rivetRow(b, [sx * 0.1, 0.745, 0.115], [sx * 0.19, 0.735, 0.08], 5, 0.007, gold);
  }
  // Rueckenstacheln entlang der Wirbelsaeule / dorsal spikes along the spine
  for (let i = 0; i < 5; i++) {
    const y = 0.56 + i * 0.045;
    b.add(geo.cone(0.016, 0.06 - i * 0.006, 6), i % 2 ? violetLight : gold, { p: [0, y, -0.125 - i * 0.002], r: [-1.2, 0, 0] });
  }
  // Ringe um die Hinterleibssegmente: Leuchtpunkte / rings around the abdomen segments: light dots
  for (const [y, r] of [[0.396, 0.17], [0.466, 0.19], [0.536, 0.18]] as [number, number][]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + y * 7;
      b.add(geo.sphere(0.006, 5, 3), k % 2 ? glow : acid, { p: [Math.sin(a) * (r + 0.004), y - 0.02, Math.cos(a) * (r + 0.004)] });
    }
  }
  // Arme: Baender an Ober- und Unterarm, Klauenring / arms: bands on the upper and forearm, claw ring
  for (const s of [-1, 1]) {
    const sh: V3 = [s * 0.25, 0.7, 0.02], el: V3 = [s * 0.36, 0.56, 0.1], hand: V3 = [s * 0.33, 0.62, 0.24];
    for (const t of [0.35, 0.65]) {
      const p = lerpV(sh, el, t);
      b.add(geo.sphere(0.034, 14, 4), t < 0.5 ? gold : violet, { p, s: [1, 0.35, 1], r: [0, 0, s * 0.9] });
    }
    const w = lerpV(el, hand, 0.75);
    b.add(geo.torus(0.022, 0.005, 4, 14), gold, { p: w, r: [0.8, s * 0.3, 0] });
    for (const t of [0.3, 0.55]) b.add(geo.sphere(0.006, 6, 3), acid, { p: lerpV(el, hand, t) });
  }
  // Gelenkkugeln an den Tentakeln / joint orbs on the tendrils
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const r1 = 0.26 + (i % 3) * 0.05;
    const root: V3 = [Math.sin(a) * 0.09, 0.33, Math.cos(a) * 0.09];
    const mid: V3 = [Math.sin(a + 0.35) * (r1 * 0.9), 0.22, Math.cos(a + 0.35) * (r1 * 0.9)];
    const tip: V3 = [Math.sin(a + 0.6) * r1, 0.05 + (i % 2) * 0.04, Math.cos(a + 0.6) * r1];
    const pts = bez(root, mid, tip, 6);
    for (const k of [2, 4]) b.add(geo.sphere(0.022 - k * 0.002, 10, 6), k === 2 ? gold : skinDark, { p: pts[k], s: [1, 0.5, 1] });
  }
  // Brustbein: goldene Leiste mit Knoten unter der Herzscheibe / sternum: gold ridge with nodes below the heart disc
  b.add(geo.rbox(0.03, 0.08, 0.016, 0.006), gold, { p: [0, 0.57, 0.13] });
  for (let i = 0; i < 3; i++) b.add(geo.sphere(0.011, 10, 6), i === 1 ? glow : acid, { p: [0, 0.545 + i * 0.025, 0.14] });
  // Halskrause aus Stacheln / collar of spikes
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.4;
    spike(b, [Math.sin(a) * 0.12, 0.76, Math.cos(a) * 0.07], [Math.sin(a) * 0.8, 0.9, Math.cos(a) * 0.4], 0.07, 0.012, i % 2 ? gold : violetLight);
  }
  // zusaetzliche Schulterstacheln und Goldnieten / extra shoulder spikes and gold rivets
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) spike(b, [s * (0.2 + k * 0.05), 0.79, 0.05 - k * 0.1], [s * 0.5, 1, k ? -0.6 : 0.4], 0.09, 0.016, violetLight);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      b.add(geo.sphere(0.007, 6, 4), gold, { p: [s * 0.22 + Math.cos(a) * 0.125, 0.73, Math.sin(a) * 0.1] });
    }
  }
  // kreisende Funken um die psychischen Kugeln / orbiting sparks around the psychic orbs
  for (const s of [-1, 1]) {
    const hand: V3 = [s * 0.33, 0.62, 0.24];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.add(geo.ico(0.008, 0), k % 2 ? glow : acid, { p: [hand[0] - s * 0.01 + Math.cos(a) * 0.045, hand[1] + 0.07 + Math.sin(a) * 0.06, hand[2] + 0.03 + Math.cos(a) * 0.04] });
    }
  }
  // Partikel im psychischen Ring / particles in the psychic ring
  boltRing(b, [0, 0.035, 0], 0.3, 24, 0.008, glow);
  boltRing(b, [0, 0.055, 0], 0.2, 16, 0.007, acid, 0.2);
}
