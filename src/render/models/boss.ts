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
import { Builder, geo, mix, shade, type ColorLike, type V3 } from './kit';
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
    tendril(b, root, mid, tip, 0.03, 0.007, 7, i % 2 ? skinDark : violetDark, i % 3 ? glow : acid);
  }
  // ---- Hinterleib: gestapelte Chitinsegmente / abdomen: stacked chitin segments ----
  const segs: [number, number, number][] = [[0.3, 0.1, 0.13], [0.36, 0.15, 0.17], [0.43, 0.18, 0.19], [0.5, 0.17, 0.18]];
  segs.forEach(([y, rb, rt], i) => {
    b.cyl(rt, rb, 0.075, 18, i % 2 ? violetDark : violet, [0, y, 0]);
    b.add(geo.torus(rt + 0.004, 0.006, 4, 24), i === 3 ? gold : acid, { p: [0, y + 0.036, 0], r: [HALF_PI, 0, 0] });
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
    b.add(geo.sphere(0.11, 14, 8), violet, { p: [s * 0.22, 0.75, 0], s: [1.2, 0.7, 1.1] });
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
    b.tube(sh, el, 0.032, 10, violetDark, 0.026);
    b.add(geo.sphere(0.03, 10, 6), gold, { p: el });
    b.tube(el, hand, 0.026, 10, skin, 0.018);
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
    b.add(geo.sphere(0.1, 22, 16), skin, { p: H, s: [0.88, 1.15, 0.92] });
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
    b.add(geo.rtaper(0.07, 0.04, 0.06, 0.035, 0.1, 0.012), metal, { p: [0.055, 0.9, 0.078], r: [0, 0.45, 0] });
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
  });
}
