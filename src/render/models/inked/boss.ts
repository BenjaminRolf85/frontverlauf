/**
 * Gezeichnete Einheiten: Endgegner der Kampagne, Schwarmmutter Xyl'Tharra (Zyrr), Atlas 'alien'.
 * Inked units: the campaign boss, Swarm Mother Xyl'Tharra (Zyrr), atlas 'alien'.
 *
 * Die groesste Einheit des Spiels: 1.76 hoch, rund dreimal so hoch wie eine Fusstruppe, schwebend (life.ts FLOATERS),
 * Lebensbalken bei 2.15 (board.ts). Sie ist deshalb von den Grenzen der Kachel ausgenommen (InkedType.maxH / maxExt).
 * Erkennungszeichen wie beim bisherigen Modell (boss.ts) und dem Anfuehrerbild: Stachelkrone ueber dem langen kahlen
 * Schaedel, ein schraeges Magenta-Auge und die Cyborg-Platte mit roter Linse, violetter Chitinpanzer mit Rippen und
 * leuchtender Herzscheibe, Schulterplatten mit Stacheln, Lichtring hinter dem Kopf, Tentakel statt Beinen.
 * Neu als Zeichen der Mutter: ein glaeserner Brutsack mit Eiern unter dem Hinterleib, um den die Tentakel haengen, und
 * eine geaederte Haut im Lichtring (Nimbus), vor der sich der helle Kopf abhebt.
 * Organisch gebaut: wenige glatte Lofts und Schlaeuche entlang von Kurven; Rippen, Fugen, Adern, Pigment, Gesicht und
 * Brut sind gezeichnet (bossPaint.ts). Leuchtfarben stehen als mat.xenoGlow / mat.acid in den Vertexfarben.
 * The largest unit of the game: 1.76 tall, about three times a foot unit, floating (life.ts FLOATERS), HP badge at 2.15
 * (board.ts). She is therefore exempt from the tile limits (InkedType.maxH / maxExt).
 * Marks of identity as on the previous model (boss.ts) and the leader art: a spiked crown above the long bald skull, one
 * slanted magenta eye and the cyborg plate with a red lens, a violet chitin carapace with ribs and a glowing heart
 * disc, shoulder plates with spikes, a light ring behind the head, tentacles instead of legs.
 * New as marks of the mother: a glass brood sac with eggs below the abdomen which the tentacles hang around, and a
 * veined skin inside the light ring (nimbus) that sets off the pale head.
 * Built organically: a few smooth lofts and tubes along curves; ribs, seams, veins, pigment, the face and the brood are
 * drawn (bossPaint.ts). Glow colours stand as mat.xenoGlow / mat.acid in the vertex colours.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import type { FactionId } from '../../../data/balance';
import { fine, mix, shade, type ColorLike, type V3 } from '../kit';
import { look, mat } from '../look';
import { HEAD } from './bossPaint';
import { ball, bez3, curve3, flatRing, sweep, TIP, torus } from './navalKit';
import { AtlasLayout, loft, UvBuilder, type Ring } from './uvkit';

/** Grenzen des Endgegners auf dem Brett: Hoehe und groesste Ausdehnung wie das bisherige Modell / the boss's limits on the board: height and largest extent as the previous model */
export const BOSS_MAX_H = 1.76;
export const BOSS_MAX_EXT = 0.51;
/** Die Masse unten sind Entwurfsmasse; das Modell steht 1.3-fach, wie das bisherige / the dimensions below are design dimensions; the model stands at 1.3 times, like the previous one */
const BOSS_K = 1.3;
const HALF_PI = Math.PI / 2;

/**
 * Ringe eines Lofts glaetten: zwischen je zwei Ringen per - 1 weitere auf einer Kurve durch die Nachbarn (Catmull-Rom).
 * Harte Ringe bleiben Knicke. So genuegen wenige Ringe fuer einen runden Umriss; niedrige Qualitaet nimmt per = 1.
 * Smooth the rings of a loft: per - 1 more between any two rings on a curve through the neighbours (Catmull-Rom). Hard
 * rings stay kinks. A few rings thus suffice for a round outline; low quality uses per = 1.
 */
function smoothRings(rings: Ring[], per: number): Ring[] {
  if (per < 2) return rings;
  const out: Ring[] = [];
  const n = rings.length;
  const v = (r: Ring) => [r.y, r.rx, r.rz ?? r.rx, r.rzB ?? r.rz ?? r.rx, r.cx ?? 0, r.cz ?? 0];
  for (let i = 0; i < n - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    const p1 = v(a), p2 = v(b);
    const p0 = i === 0 || a.hard ? p1 : v(rings[i - 1]);
    const p3 = i + 2 >= n || b.hard ? p2 : v(rings[i + 2]);
    out.push(a);
    for (let k = 1; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const q = p1.map((_, j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3));
      // die Hoehe bleibt zwischen den beiden Ringen (t der Zelle laeuft mit der Hoehe) / the height stays between the two rings (the cell's t runs with the height)
      const y = Math.min(Math.max(q[0], Math.min(a.y, b.y)), Math.max(a.y, b.y));
      out.push({ y, rx: Math.max(TIP, q[1]), rz: Math.max(TIP, q[2]), rzB: Math.max(TIP, q[3]), cx: q[4], cz: q[5], e: a.e });
    }
  }
  out.push(rings[n - 1]);
  return out;
}

/**
 * Stachel oder Horn von root in Richtung dir: gerade (n = 1) oder gebogen ueber bend; laeuft spitz aus. Gibt die Spitze zurueck.
 * Spike or horn from root along dir: straight (n = 1) or curved by bend; tapers to a point. Returns the tip.
 */
function thorn(b: UvBuilder, A: AtlasLayout, root: V3, dir: V3, len: number, r: number, color: ColorLike, o: { bend?: V3; n?: number; seg?: number; cell?: string; gloss?: number } = {}): V3 {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const at = (t: number, k = 0): V3 => [root[0] + (dir[0] / l) * len * t + (o.bend?.[0] ?? 0) * k, root[1] + (dir[1] / l) * len * t + (o.bend?.[1] ?? 0) * k, root[2] + (dir[2] / l) * len * t + (o.bend?.[2] ?? 0) * k];
  const tip = at(1), n = o.n ?? 1;
  const path = n > 1 ? bez3(root, at(0.5, 1), tip, n) : [root, tip];
  b.add(sweep(path, (t) => (t > 0.999 ? TIP : r * (1 - 0.9 * t)), { seg: o.seg ?? (fine() ? 7 : 5), region: A.get(o.cell ?? 'blank'), color, face: [0.3, 0.2, 1] }), null, { crease: 0, gloss: o.gloss ?? 0 });
  return tip;
}

export function swarmMother(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  b.group({ s: BOSS_K }, () => mother(b, A, f));
  return b;
}

function mother(b: UvBuilder, A: AtlasLayout, f: FactionId): void {
  const L = look(f), hi = fine();
  const violet = L.primary, violetDark = shade(L.primary, 0.55), violetLight = shade(L.primary, 1.25);
  const skin = mix(mat.alienSkin, violetLight, 0.2), skinDark = shade(skin, 0.7);
  const gold = mix(mat.gold, mat.white, 0.15);
  const glow = mat.xenoGlow, acid = mat.acid;
  const glass = mix(mat.xenoGlow, mat.glassDark, 0.5);
  const seg = hi ? 32 : 20, per = hi ? 3 : 2;
  const around = (a: number, r: number, y: number, rz = r): V3 => [Math.sin(a) * r, y, Math.cos(a) * rz];

  // ---- psychischer Ring am Boden (zeigt das Schweben) / psychic ring on the ground (shows the hovering) ----
  flatRing(b, [0, 0.012, 0], 0.3, 0.008, glow, { seg: hi ? 40 : 28 });
  flatRing(b, [0, 0.012, 0], 0.2, 0.006, acid, { seg: hi ? 32 : 22 });
  if (hi) for (let i = 0; i < 12; i++) ball(b, A, around((i / 12) * Math.PI * 2 + 0.1, i % 2 ? 0.2 : 0.3, 0.016), 0.011, i % 2 ? glow : acid, { rows: 3, seg: 6 });

  // ---- Tentakel: haengen unter dem Chitinkragen um den Brutsack, vorn bleibt eine Luecke; die Spitzen rollen sich auf ----
  // ---- tentacles: hang below the chitin cowl around the brood sac, a gap stays at the front; the tips curl up ----
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2, r1 = 0.27 + (i % 3) * 0.04, lift = (i % 2) * 0.03;
    const path = curve3([around(a, 0.19, 0.415), around(a + 0.05, 0.226, 0.33), around(a + 0.22, r1 * 0.9, 0.2), around(a + 0.45, r1, 0.07 + lift), around(a + 0.7, r1 * 0.86, 0.11 + lift)], hi ? 3 : 2);
    b.add(sweep(path, (t) => 0.0065 + 0.028 * Math.pow(1 - t, 0.8), { seg: hi ? 10 : 6, region: A.get('tentacle'), color: i % 2 ? skinDark : violetDark, face: around(a + 0.3, 1, 0.5), capEnd: true }), null, { crease: 0 });
    ball(b, A, path[path.length - 1], 0.015, i % 3 ? glow : acid, { rows: hi ? 4 : 3, seg: hi ? 8 : 6, gloss: 0.8 });
  }

  // ---- Brutsack aus Glas: Eier und Adern sind gezeichnet / glass brood sac: eggs and veins are drawn ----
  b.add(loft(smoothRings([
    { y: 0.408, rx: 0.16, hard: true, c: glass }, { y: 0.36, rx: 0.186 }, { y: 0.3, rx: 0.178 }, { y: 0.25, rx: 0.13 }, { y: 0.215, rx: 0.06 }, { y: 0.2, rx: TIP },
  ], per), { seg, region: A.get('brood') }), null, { gloss: 0.85, crease: 0 });

  // ---- Hinterleib: zwei Chitinglocken uebereinander, die untere als Kragen ueber dem Brutsack; Leuchtfuge dazwischen ----
  // ---- abdomen: two chitin bells one above the other, the lower one a cowl over the brood sac; a glowing joint between ----
  const bell = (y0: number, y1: number, r0: number, r1: number, c: ColorLike) => {
    const h = y0 - y1;
    b.add(loft(smoothRings([
      { y: y0, rx: r0, hard: true, c }, { y: y0 - h * 0.3, rx: r0 + (r1 - r0) * 0.62 }, { y: y0 - h * 0.72, rx: r1 * 0.985 }, { y: y1, rx: r1, hard: true },
    ], per), { seg, region: A.get('bossSegment') }), null, { crease: 0.7 });
  };
  bell(0.566, 0.49, 0.138, 0.198, violetDark);
  bell(0.502, 0.4, 0.163, 0.234, violet);
  b.add(loft([{ y: 0.506, rx: 0.166, hard: true }, { y: 0.498, rx: 0.176 }, { y: 0.49, rx: 0.17, hard: true }], { seg, region: A.get('blank'), color: acid }), null, { crease: 0 });
  b.add(loft([{ y: 0.576, rx: 0.136, hard: true }, { y: 0.57, rx: 0.146 }, { y: 0.563, rx: 0.14, hard: true }], { seg, region: A.get('blank'), color: gold }), null, { crease: 0, gloss: 0.6 });
  // Stachelkraenze an den Raendern der Glocken / spike rings at the rims of the bells
  const spikes = hi ? 8 : 5;
  for (let k = 0; k < spikes; k++) {
    const a = (k / spikes) * Math.PI * 2 + 0.4;
    thorn(b, A, around(a, 0.226, 0.412), [Math.sin(a), 0.42, Math.cos(a)], 0.075, 0.015, violetLight);
    if (hi) thorn(b, A, around(a + 0.39, 0.19, 0.5), [Math.sin(a + 0.39), 0.5, Math.cos(a + 0.39)], 0.06, 0.013, violetLight);
  }

  // ---- Brustpanzer: Rippen und Adern sind gezeichnet, die Herzscheibe ist modelliert ----
  // ---- chest carapace: ribs and veins are drawn, the heart disc is modelled ----
  b.add(loft(smoothRings([
    { y: 0.79, rx: 0.062, rz: 0.058, hard: true, c: violet }, { y: 0.776, rx: 0.13, rz: 0.094 }, { y: 0.75, rx: 0.204, rz: 0.132 },
    { y: 0.7, rx: 0.212, rz: 0.142 }, { y: 0.64, rx: 0.186, rz: 0.132 }, { y: 0.6, rx: 0.16, rz: 0.118 }, { y: 0.565, rx: 0.136, rz: 0.106, hard: true },
  ], per), { seg, region: A.get('bossChest') }), null, { crease: 0.6 });
  const hy = 0.79 - 0.54 * 0.225, hz = 0.137;
  b.group({ p: [0, hy, hz], r: [HALF_PI, 0, 0] }, () => {
    // Ein Loft zeigt immer von der Achse weg: die Fassung laeuft deshalb von aussen unten nach innen oben (Flanke,
    // dann ebene Oberseite, dann Deckel), nie als Trichter. Die Linse sitzt mit ihrem Aequator auf dem Deckel.
    // A loft always faces away from its axis: the socket therefore runs from outside below to inside above (flank,
    // then a flat top, then the cap), never as a funnel. The lens sits with its equator on the cap.
    const hs = hi ? 24 : 14;
    b.add(loft([{ y: -0.006, rx: 0.07, c: gold }, { y: 0.012, rx: 0.068, hard: true }, { y: 0.019, rx: 0.059, hard: true }, { y: 0.019, rx: 0.046, hard: true }], { seg: hs, region: A.get('blank'), capLast: true }), null, { gloss: 0.6, crease: 0.5 });
    ball(b, A, [0, 0.019, 0], 0.043, glow, { ry: 0.025, rows: hi ? 6 : 4, seg: hs, gloss: 1 });
  });
  if (hi) for (let i = 0; i < 3; i++) ball(b, A, [0, hy - 0.082 - i * 0.022, 0.128 - i * 0.004], 0.011, i === 1 ? glow : acid, { rows: 3, seg: 6, gloss: 0.8 });
  // Rueckenstacheln entlang der Wirbel / dorsal spikes along the spine
  if (hi) for (let i = 0; i < 4; i++) thorn(b, A, [0, 0.6 + i * 0.045, -0.118 - Math.sin((i / 3) * Math.PI) * 0.02], [0, 0.45, -1], 0.07 - i * 0.006, 0.016, i % 2 ? violetLight : gold);

  // ---- Schulterplatten mit Goldrand und Stacheln, Rueckenklingen, Arme mit Klauen und psychischen Kugeln ----
  // ---- shoulder plates with a gold rim and spikes, back blades, arms with claws and psychic orbs ----
  b.mirrorX(() => {
    b.group({ p: [0.232, 0.742, 0], r: [0, 0, -0.3] }, () => {
      const dome: Ring[] = [];
      const rows = hi ? 7 : 5;
      for (let i = 0; i <= rows; i++) {
        const a = (i / rows) * HALF_PI;
        dome.push({ y: Math.cos(a) * 0.078, rx: Math.max(TIP, Math.sin(a) * 0.124), rz: Math.max(TIP, Math.sin(a) * 0.112), ...(i === 0 ? { c: violet } : {}) });
      }
      dome[rows].hard = true;
      b.add(loft(dome, { seg: hi ? 22 : 14, region: A.get('bossPauldron'), arc: true }), null, { crease: 0.6 });
      b.add(loft([{ y: 0, rx: 0.124, rz: 0.112, hard: true, c: gold }, { y: -0.008, rx: 0.132, rz: 0.12 }, { y: -0.018, rx: 0.124, rz: 0.112, hard: true, c: violetDark }, { y: -0.03, rx: 0.07, rz: 0.062 }, { y: -0.034, rx: TIP }], { seg: hi ? 22 : 14, region: A.get('blank') }), null, { gloss: 0.5, crease: 0.5 });
    });
    for (let k = 0; k < 3; k++) thorn(b, A, [0.262 + k * 0.03, 0.785 - k * 0.012, -0.04 + k * 0.04], [0.9 - k * 0.2, 1, -0.2], 0.16 - k * 0.03, 0.024, k === 1 ? gold : violetLight, { n: hi ? 3 : 2, bend: [0.012, 0, -0.01], cell: 'horn', gloss: k === 1 ? 0.5 : 0 });
    if (hi) for (let k = 0; k < 2; k++) thorn(b, A, [0.2 + k * 0.05, 0.795, 0.05 - k * 0.1], [0.5, 1, k ? -0.6 : 0.4], 0.085, 0.016, violetLight);
    // Rueckenklinge: gebogenes Horn mit Leuchtspitze / back blade: a curved horn with a glowing tip
    const tip = thorn(b, A, [0.1, 0.69, -0.1], [0.56, 0.84, -0.22], 0.42, 0.03, violetDark, { n: hi ? 5 : 3, seg: hi ? 8 : 5, bend: [-0.05, 0.03, -0.05], cell: 'horn' });
    ball(b, A, tip, 0.011, acid, { rows: 3, seg: 6 });
    // Arm: Oberarm in Chitin, Goldgelenk, Unterarm aus Haut / arm: upper arm in chitin, gold joint, forearm of skin
    const sh: V3 = [0.262, 0.7, 0.02], el: V3 = [0.352, 0.56, 0.1], hand: V3 = [0.31, 0.62, 0.25];
    b.add(sweep([sh, el], (t) => 0.036 - 0.008 * t, { seg: hi ? 12 : 7, region: A.get('sinew'), color: violetDark, face: [0.4, 0, 1] }), null, { crease: 0 });
    ball(b, A, el, 0.032, gold, { rows: hi ? 5 : 3, seg: hi ? 10 : 6, gloss: 0.6 });
    b.add(sweep([el, hand], (t) => 0.027 - 0.008 * t, { seg: hi ? 12 : 7, region: A.get('sinew'), color: skin, face: [0.4, 1, 0] }), null, { crease: 0 });
    if (hi) b.add(loft([{ y: 0.006, rx: 0.024, hard: true, c: gold }, { y: 0, rx: 0.027 }, { y: -0.006, rx: 0.024, hard: true }], { seg: 10, region: A.get('blank') }), null, { xf: { p: [hand[0] + (el[0] - hand[0]) * 0.28, hand[1] + (el[1] - hand[1]) * 0.28, hand[2] + (el[2] - hand[2]) * 0.28], r: [1.2, 0, 0.25] }, gloss: 0.6, crease: 0 });
    ball(b, A, hand, 0.026, skin, { rows: hi ? 4 : 3, seg: hi ? 8 : 6 });
    for (const a of [-0.6, 0, 0.6]) thorn(b, A, [hand[0] + Math.sin(a) * 0.012, hand[1], hand[2] + 0.012], [Math.sin(a) * 0.6 + 0.1, 0.45, 1], 0.07, 0.01, skinDark, { seg: 5 });
    const orb: V3 = [hand[0], hand[1] + 0.078, hand[2] + 0.03];
    ball(b, A, orb, 0.046, glow, { rows: hi ? 6 : 4, seg: hi ? 14 : 10, gloss: 1 });
    torus(b, orb, 0.062, 0.0055, acid, { rot: [0.6, 0.4, 0], seg: hi ? 18 : 12, tube: 4 });
  });

  // ---- Hals mit Ringfalten, goldener Halskragen mit Stacheln / neck with ring folds, a gold gorget with spikes ----
  b.add(loft([
    { y: 0.875, rx: 0.046, cz: 0.012, c: skin }, { y: 0.85, rx: 0.05, hard: true, cz: 0.01 }, { y: 0.842, rx: 0.056, cz: 0.01 }, { y: 0.826, rx: 0.05, hard: true, cz: 0.008 },
    { y: 0.818, rx: 0.058, cz: 0.008 }, { y: 0.802, rx: 0.053, hard: true, cz: 0.006 }, { y: 0.795, rx: 0.06, cz: 0.006 }, { y: 0.78, rx: 0.062 },
  ], { seg: hi ? 16 : 8, region: A.get('blank') }), null, { crease: 0.5 });
  b.add(loft([{ y: 0.802, rx: 0.07, rz: 0.066, hard: true, c: gold }, { y: 0.79, rx: 0.088, rz: 0.08 }, { y: 0.781, rx: 0.084, rz: 0.076, hard: true }], { seg: hi ? 20 : 10, region: A.get('blank') }), null, { gloss: 0.6 });
  if (hi) for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    thorn(b, A, [Math.sin(a) * 0.105, 0.78, Math.cos(a) * 0.08], [Math.sin(a) * 0.8, 0.9, Math.cos(a) * 0.4], 0.066, 0.012, i % 2 ? gold : violetLight);
  }

  // ---- Kopf: ein Loft vom Scheitel zum Kinn, hinten lang ausgezogen; das Gesicht ist gezeichnet ----
  // ---- head: one loft from crown to chin, drawn out long at the back; the face is drawn ----
  // der Kopf ist leicht in den Nacken gelegt: aus der Brettansicht von schraeg oben bleibt das Gesicht zu sehen
  // the head is tilted back slightly: seen from the board's raised view the face stays visible
  const by = HEAD.bandY, pivot = 0.84;
  b.group({ p: [0, pivot, 0], r: [-0.2, 0, 0] }, () => b.group({ p: [0, -pivot, 0] }, () => {
    b.add(loft(smoothRings([
      { y: HEAD.top, rx: TIP, cz: -0.04, c: skin }, { y: 1.064, rx: 0.055, rz: 0.05, rzB: 0.08, cz: -0.04 }, { y: 1.035, rx: 0.1, rz: 0.095, rzB: 0.145, cz: -0.035 },
      { y: 0.985, rx: 0.128, rz: 0.128, rzB: 0.185, cz: -0.025 }, { y: 0.935, rx: 0.137, rz: 0.139, rzB: 0.185, cz: -0.005 }, { y: 0.885, rx: 0.13, rz: 0.14, rzB: 0.15, cz: 0.008 },
      { y: 0.835, rx: 0.108, rz: 0.13, rzB: 0.11, cz: 0.014 }, { y: 0.79, rx: 0.074, rz: 0.1, rzB: 0.075, cz: 0.02 }, { y: 0.755, rx: 0.038, rz: 0.06, rzB: 0.042, cz: 0.03 }, { y: HEAD.bottom, rx: TIP, cz: 0.035 },
    ], per), { seg: hi ? 36 : 22, region: A.get('bossHead') }), null, { crease: 0 });
    // rote Linse der Cyborg-Platte in dunkler Fassung, leicht vorstehend / red lens of the cyborg plate in a dark socket, protruding slightly
    b.group({ p: [HEAD.lensX + 0.003, HEAD.eyeY, 0.1235], r: [0, 0.575, 0] }, () => {
      b.add(loft([{ y: -0.004, rx: 0.04, c: mat.dark }, { y: 0.004, rx: 0.039, hard: true }, { y: 0.011, rx: 0.034, hard: true }, { y: 0.011, rx: 0.027, hard: true }], { seg: hi ? 16 : 10, region: A.get('blank'), capLast: true }), null, { xf: { r: [HALF_PI, 0, 0] }, gloss: 0.5 });
      ball(b, A, [0, 0, 0.008], 0.026, shade(mat.red, 1.25), { rows: hi ? 5 : 3, seg: hi ? 12 : 8, gloss: 1, s: [1, 1, 0.55] });
    });
    // goldener Kronreif um den Schaedel / gold crown band around the skull
    b.add(loft([
      { y: by - 0.014, rx: 0.113, rz: 0.111, rzB: 0.164, cz: -0.031, hard: true, c: gold }, { y: by - 0.012, rx: 0.124, rz: 0.122, rzB: 0.175, cz: -0.031, hard: true },
      { y: by + 0.014, rx: 0.101, rz: 0.099, rzB: 0.149, cz: -0.035, hard: true }, { y: by + 0.016, rx: 0.089, rz: 0.087, rzB: 0.136, cz: -0.035, hard: true },
    ], { seg: hi ? 36 : 22, region: A.get('blank') }), null, { gloss: 0.6 });
    // Stachelkrone: elf Hoerner, vorn am laengsten, abwechselnd Gold und helles Chitin
    // spiked crown: eleven horns, the longest at the front, alternating gold and light chitin
    for (let i = 0; i < 11; i++) {
      const a = -1.5 + (i / 10) * 3, w = 1 - Math.abs(a) / 1.5;
      const root: V3 = [Math.sin(a) * 0.098, by + 0.006, -0.036 + Math.cos(a) * 0.097];
      thorn(b, A, root, [Math.sin(a) * 0.75, 1, Math.cos(a) * 0.15 - 0.32], (0.12 + w * 0.14) * 1.27, 0.028, i % 2 ? gold : violetLight, { n: hi ? 4 : 2, seg: hi ? 8 : 5, bend: [Math.sin(a) * 0.022, 0, 0.026], cell: 'horn', gloss: i % 2 ? 0.5 : 0 });
      if (hi && i % 2 === 0 && i > 0 && i < 10) ball(b, A, [Math.sin(a) * 0.118, by, -0.033 + Math.cos(a) * 0.117], 0.01, i % 4 ? glow : mix(mat.red, mat.xenoGlow, 0.3), { rows: 3, seg: 6, gloss: 1 });
    }
  }));

  // ---- Nimbus hinter dem Kopf: Lichtring, geaederte Haut darin, duenner Aussenring mit Knoten ----
  // ---- nimbus behind the head: light ring, a veined skin inside it, a thin outer ring with nodes ----
  const nz = -0.262, ny = 0.925, r0 = 0.283, r1 = 0.337, rin = 0.186;
  const web = mix(shade(violet, 0.3), mat.ink, 0.25);
  b.add(loft([{ y: 0, rx: r0, hard: true }, { y: 0, rx: rin, hard: true }], { seg: hi ? 40 : 26, region: A.get('nimbus'), color: web }), null, { xf: { p: [0, ny, nz], r: [HALF_PI, 0, 0] }, crease: 0.6 });
  b.add(loft([{ y: 0, rx: rin, hard: true }, { y: 0, rx: r0, hard: true }], { seg: hi ? 40 : 26, region: A.get('nimbus'), color: web, t0: 1, t1: 0 }), null, { xf: { p: [0, ny, nz - 0.006], r: [HALF_PI, 0, 0] }, crease: 0.6 });
  torus(b, [0, ny, nz - 0.003], r0, 0.011, glow, { rot: [HALF_PI, 0, 0], seg: hi ? 44 : 26, tube: hi ? 6 : 4 });
  torus(b, [0, ny, nz - 0.003], r1, 0.0055, acid, { rot: [HALF_PI, 0, 0], seg: hi ? 44 : 26, tube: hi ? 4 : 3 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    ball(b, A, [Math.cos(a) * r1, ny + Math.sin(a) * r1, nz - 0.003], 0.013, k % 2 ? gold : glow, { rows: 3, seg: 6, gloss: 0.8 });
    if (hi) b.add(sweep([[Math.cos(a) * (r0 + 0.01), ny + Math.sin(a) * (r0 + 0.01), nz - 0.003], [Math.cos(a) * (r1 - 0.004), ny + Math.sin(a) * (r1 - 0.004), nz - 0.003]], 0.004, { seg: 4, region: A.get('blank'), color: acid }), null, { crease: 0 });
  }
}
