/**
 * Gezeichnete Einheiten der Gruppe Figuren: Beiwerk als Koerper mit Texturkoordinaten (Zeichnung in propPaint.ts).
 * Inked units of group figures: props as bodies with texture coordinates (drawing in propPaint.ts).
 *
 * Raketenrohr, Schild, Bretter, Banner, Drucktank, Flamme, Laterne, Sandsack, Koffer, Axt: jedes Teil ist ein Loft oder
 * ein projizierter weicher Quader mit einer der allgemeinen Zellen. Alle Masse in Baugroesse der Figur.
 * Rocket tube, shield, boards, banner, pressure tank, flame, lantern, sandbag, case, axe: every part is a loft or a
 * projected soft box using one of the generic cells. All dimensions at the figure's build size.
 */
import type { FactionId } from '../../../data/balance';
import { fine, geo, mix, shade, type ColorLike, type V3 } from '../kit';
import { mat } from '../look';
import { aimY, bead, box, cell, faces, rod, TIP } from './figkit';
import { emblemDecal } from './trim';
import { AtlasLayout, loft, loftAt, projectBox, ribbon, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;

// ---------- Raketenrohr / rocket tube ----------

export type TubeStyle = 'korvat' | 'dravon' | 'alvenia' | 'meridon' | 'velkar' | 'cult';
export interface TubeOpts { r: number; len: number; c: ColorLike; band: ColorLike; style: TubeStyle }

/**
 * Schultergestuetztes Raketenrohr: Mitte bei p, Richtung +z, um pitch geneigt (negativ = Muendung hoch). Ein Loft vom
 * Trichter ueber Rohr, Baender und Muendungsring bis zur Spitze des Gefechtskopfs.
 * Shoulder rocket tube: centre at p, along +z, tilted by pitch (negative = muzzle up). One loft from the flare over
 * tube, bands and muzzle collar to the tip of the warhead.
 */
export function rocketTube(b: UvBuilder, A: AtlasLayout, p: V3, pitch: number, o: TubeOpts): void {
  const hi = fine(), seg = hi ? 14 : 8;
  const { r, len: L } = o;
  const sq = o.style === 'velkar';
  const e = sq ? 4.5 : 2;
  const warhead = o.style === 'cult' ? mat.rust : o.style === 'dravon' ? o.band : shade(o.c, 0.7);
  const bandC = sq || o.style === 'meridon' ? o.c : o.band, bandR = sq || o.style === 'meridon' ? r : r * 1.1;
  // der Loft laeuft entlang -y und wird nach +z gekippt: so liegt die Mitte der Zelle oben / the loft runs along -y and is tipped to +z: the cell's centre is then on top
  const R = (v: number, rx: number, extra: Partial<Ring> = {}): Ring => ({ y: -v, rx, e, ...extra });
  const rings: Ring[] = [
    R(-L / 2 - 0.05, r * 1.45, { c: mat.dark, hard: true }),
    R(-L / 2 - 0.004, r * 1.02, { hard: true }),
    R(-L / 2, r, { c: o.c, hard: true }),
    R(-L * 0.22 - 0.011, r, { hard: true }), R(-L * 0.22 - 0.011, bandR, { c: bandC, hard: true }), R(-L * 0.22 + 0.011, bandR, { hard: true }), R(-L * 0.22 + 0.011, r, { c: o.c, hard: true }),
    R(L * 0.18 - 0.011, r, { hard: true }), R(L * 0.18 - 0.011, bandR, { c: bandC, hard: true }), R(L * 0.18 + 0.011, bandR, { hard: true }), R(L * 0.18 + 0.011, r, { c: o.c, hard: true }),
    R(L / 2 - 0.024, r, { hard: true }), R(L / 2 - 0.024, r * 1.09, { c: mat.dark, hard: true }), R(L / 2, r * 1.09, { hard: true }),
    R(L / 2, r * 0.92, { c: warhead, e: 2, hard: true }), R(L / 2 + r * 1.5, r * 1.22, { e: 2 }), R(L / 2 + r * 2.3, r * 1.2, { e: 2 }),
    R(L / 2 + r * 4.3, r * 0.2, { e: 2 }), R(L / 2 + r * 4.6, TIP, { e: 2 }),
  ];
  b.group({ p, r: [pitch, 0, 0] }, () => {
    b.group({ r: [-HALF_PI, 0, 0] }, () => {
      b.add(loft(rings, { seg, region: cell(A, 'tube'), capFirst: true }), null, { gloss: 0.35 });
      // Meridon: Warnstreifen als Band um das Rohr / Meridon: hazard stripes as a band around the tube
      if (o.style === 'meridon') for (const v of [-L * 0.22, L * 0.18]) {
        const path = [];
        const n = hi ? 10 : 5;
        for (let i = 0; i <= n; i++) path.push(loftAt(rings, 0.12 + (i / n) * 0.76, -v));
        b.add(ribbon(path, 0.013, cell(A, 'hazard'), 0.0025), mat.yellow, { crease: 0 });
      }
    });
    if (sq) box(b, A, [r * 2.1, r * 0.5, L * 0.86], 0.004, {}, o.band, { xf: { p: [0, r * 1.0, 0] } });
    // Kult: Klebeband und Glocke / cult: tape and a bell
    if (o.style === 'cult') {
      b.add(loft([{ y: 0.016, rx: r * 1.04 }, { y: -0.016, rx: r * 1.04 }], { seg, region: A.get('blank'), color: mat.paper }), null, { xf: { p: [0, 0, -L * 0.05], r: [-HALF_PI, 0, 0] }, crease: 0.6 });
      if (hi) bead(b, A, [r * 1.25, -r * 1.3, -L * 0.3], r * 0.5, mat.gold, 6, { gloss: 0.8 }, [1, 1.3, 1]);
    }
    // Visier und Griffe / sight and grips
    box(b, A, [0.022, 0.03, 0.05], 0.005, {}, mat.dark, { xf: { p: [-r - 0.012, r * 0.45, L * 0.08] } });
    if (hi) bead(b, A, [-r - 0.012, r * 0.45, L * 0.08 + 0.026], 0.008, mat.glass, 6, { gloss: 1 }, [1, 1, 0.4]);
    box(b, A, [0.016, 0.046, 0.02], 0.004, {}, mat.dark, { xf: { p: [0, -r - 0.018, 0.02], r: [0.3, 0, 0] } });
    box(b, A, [0.016, 0.04, 0.02], 0.004, {}, mat.dark, { xf: { p: [0, -r - 0.016, L * 0.24], r: [0.2, 0, 0] } });
  });
}

/** Ersatzrakete entlang +z, Mitte bei p, um ry gedreht / spare rocket along +z, centre at p, turned by ry */
export function spareRocket(b: UvBuilder, A: AtlasLayout, p: V3, r: number, len: number, c: ColorLike, rot: V3 = [0, 0, 0], tip: ColorLike = mat.dark): void {
  const seg = fine() ? 8 : 6;
  b.group({ p, r: rot }, () => {
    b.add(loft([
      { y: len / 2, rx: r * 0.7, c, hard: true }, { y: len / 2 - 0.004, rx: r, hard: true }, { y: -len / 2, rx: r, hard: true },
      { y: -len / 2, rx: r * 1.04, c: tip, hard: true }, { y: -len / 2 - r * 0.9, rx: r * 1.1 }, { y: -len / 2 - r * 2.6, rx: TIP },
    ], { seg, region: A.get('blank'), capFirst: true }), null, { xf: { r: [-HALF_PI, 0, 0] }, gloss: 0.3 });
    // Leitwerk / fins
    for (const a of [0, HALF_PI]) box(b, A, [r * 3, 0.004, len * 0.24], 0.001, {}, mat.dark, { xf: { p: [0, 0, -len * 0.38], r: [0, 0, a] }, crease: 0.6 });
  });
}

// ---------- Schild, Bretter, Tuch / shield, boards, cloth ----------

export interface ShieldOpts { w: number; h: number; t: number; c: ColorLike; trim?: ColorLike; emblem?: FactionId; emblemSize?: number; cellName?: string }
/** Schild: Unterkante im Ursprung, Schauseite +z / shield: lower edge at the origin, show side +z */
export function shield(b: UvBuilder, A: AtlasLayout, o: ShieldOpts): void {
  const { w, h, t } = o;
  box(b, A, [w, h, t], Math.min(0.008, t * 0.4), { pz: o.cellName ?? 'shield', nz: 'plate' }, o.c, { xf: { p: [0, h / 2, 0] }, gloss: 0.3 });
  if (o.trim) for (const y of [0.01, h - 0.01]) box(b, A, [w + 0.006, 0.018, t + 0.005], 0.004, {}, o.trim, { xf: { p: [0, y, 0] }, gloss: 0.4 });
  if (o.emblem) emblemDecal(b, A, o.emblem, [0, h * 0.46, t / 2], [0, 0, 1], o.emblemSize ?? w * 0.5, o.c);
}

/** Brett oder Kiste aus Holz (alle Seiten Zelle 'wood') / board or crate made of wood (all faces cell 'wood') */
export function board(b: UvBuilder, A: AtlasLayout, size: V3, c: ColorLike, xf: { p?: V3; r?: V3 } = {}): void {
  box(b, A, size, 0.004, { all: 'wood' }, c, { xf });
}
/** Banner oder Wimpel: duennes Tuch, beide Seiten gezeichnet / banner or pennant: thin cloth, both sides drawn */
export function banner(b: UvBuilder, A: AtlasLayout, w: number, h: number, c: ColorLike, xf: { p?: V3; r?: V3 } = {}): void {
  box(b, A, [w, h, 0.007], 0.002, { pz: 'cloth', nz: 'cloth' }, c, { xf, crease: 0.7 });
}
/** Blechkoffer / metal case */
export function caseBox(b: UvBuilder, A: AtlasLayout, size: V3, c: ColorLike, xf: { p?: V3; r?: V3 } = {}): void {
  box(b, A, size, Math.min(size[0], size[1], size[2]) * 0.18, { px: 'case', nx: 'case', pz: 'case', nz: 'case' }, c, { xf, gloss: 0.2 });
}

// ---------- Tank, Flamme, Laterne / tank, flame, lantern ----------

/** Stehender Drucktank: Boden bei p, Radius r, Hoehe h, gewoelbter Kopf mit Ventil / upright pressure tank: base at p, radius r, height h, domed head with a valve */
export function gasTank(b: UvBuilder, A: AtlasLayout, p: V3, r: number, h: number, c: ColorLike, glow?: ColorLike): void {
  const seg = fine() ? 12 : 8;
  const rings: Ring[] = [
    { y: h + r * 0.55, rx: TIP, c }, { y: h + r * 0.48, rx: r * 0.45 }, { y: h + r * 0.2, rx: r * 0.9 }, { y: h, rx: r, hard: true },
    ...(glow ? [{ y: h * 0.34, rx: r, hard: true }, { y: h * 0.34, rx: r * 1.03, hard: true, c: glow }, { y: h * 0.26, rx: r * 1.03, hard: true }, { y: h * 0.26, rx: r, hard: true, c }] as Ring[] : []),
    { y: 0.008, rx: r, hard: true }, { y: 0, rx: r * 0.86 },
  ];
  b.group({ p }, () => {
    b.add(loft(rings, { seg, region: cell(A, 'tank'), capLast: true }), null, { gloss: 0.3 });
    rod(b, A, [0, h + r * 0.5, 0], [0, h + r * 0.5 + 0.02, 0], 0.006, 0.006, 5, mat.metal, { gloss: 0.6 });
  });
}

/** Flamme entlang dir: heller Kern am Rohr, Glut zur Spitze, Funken davor / flame along dir: bright core at the nozzle, ember towards the tip, sparks ahead */
export function flame(b: UvBuilder, A: AtlasLayout, p: V3, dir: V3, len: number): void {
  const hi = fine(), r = len * 0.24;
  b.group({ p, r: aimY(dir) }, () => {
    b.add(loft([
      { y: 0, rx: r * 0.4, c: mat.yellow }, { y: len * 0.16, rx: r * 0.86 }, { y: len * 0.34, rx: r, hard: true },
      { y: len * 0.34, rx: r * 1.04, hard: true, c: mat.ember }, { y: len * 0.62, rx: r * 0.72 }, { y: len * 0.84, rx: r * 0.36, cx: r * 0.2 }, { y: len, rx: TIP, cx: r * 0.4 },
    ], { seg: hi ? 10 : 6, region: A.get('blank') }), null, { crease: 0.5 });
    if (hi) for (let i = 0; i < 3; i++) bead(b, A, [(i - 1) * r * 0.5, len * (1.02 + i * 0.1), i % 2 ? r * 0.3 : -r * 0.2], len * (0.05 + i * 0.012), i % 2 ? mat.yellow : mat.ember, 5);
  });
}

/** Glutlaterne: Boden bei p, Massstab s / ember lantern: base at p, scale s */
export function lantern(b: UvBuilder, A: AtlasLayout, p: V3, s: number): void {
  b.group({ p, s }, () => {
    b.add(loft([{ y: 0.008, rx: 0.016, c: mat.rustDark, hard: true }, { y: 0, rx: 0.017, hard: true }], { seg: 6, region: A.get('blank'), capFirst: true, capLast: true }), null, { crease: 0.6 });
    bead(b, A, [0, 0.026, 0], 0.014, mat.ember, 6, {}, [1, 1.2, 1]);
    if (fine()) for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; rod(b, A, [Math.sin(a) * 0.015, 0.006, Math.cos(a) * 0.015], [Math.sin(a) * 0.015, 0.048, Math.cos(a) * 0.015], 0.0022, 0.0022, 4, mat.rustDark); }
    b.add(loft([{ y: 0.07, rx: TIP, c: mat.rustDark }, { y: 0.05, rx: 0.021, hard: true }, { y: 0.046, rx: 0.019 }], { seg: 6, region: A.get('blank'), capLast: true }), null, { crease: 0.6 });
  });
}

// ---------- Sandsack / sandbag ----------

/** Sandsack auf dem Boden: Mitte bei (x, z), Unterkante y, um ry gedreht / sandbag on the ground: centre at (x, z), lower edge y, turned by ry */
export function sandbag(b: UvBuilder, A: AtlasLayout, x: number, y: number, z: number, ry: number, c: ColorLike = mat.sandbag, k = 1): void {
  const hh = 0.024 * k, hd = 0.05 * k, hl = 0.06 * k;
  const rings: Ring[] = [
    { y: hl, rx: hh * 0.3, rz: hd * 0.5, e: 2.4, hard: true }, { y: hl * 0.86, rx: hh * 0.86, rz: hd * 0.9, e: 2.6 }, { y: hl * 0.5, rx: hh, rz: hd, e: 2.8 },
    { y: -hl * 0.5, rx: hh, rz: hd, e: 2.8 }, { y: -hl * 0.86, rx: hh * 0.86, rz: hd * 0.9, e: 2.6 }, { y: -hl, rx: hh * 0.3, rz: hd * 0.5, e: 2.4, hard: true },
  ];
  b.group({ p: [x, y + hh, z], r: [0, ry, 0] }, () => b.add(loft(rings, { seg: fine() ? 10 : 6, region: cell(A, 'sandbag'), capFirst: true, capLast: true, color: c }), null, { xf: { r: [0, 0, HALF_PI] }, crease: 0.5 }));
}

// ---------- Axt und Hammer / axe and hammer ----------

/** Handaxt: Stiel von der Hand entlang dir, Bartklinge am Ende, um spin um den Stiel gedreht / hand axe: haft from the hand along dir, bearded blade at the end, turned by spin around the haft */
export function handAxe(b: UvBuilder, A: AtlasLayout, hand: V3, dir: V3, len: number, spin: number): void {
  b.group({ p: hand, r: aimY(dir) }, () => {
    rod(b, A, [0, -0.05, 0], [0, len, 0], 0.0095, 0.011, fine() ? 7 : 5, mat.wood, { cell: 'blank' });
    b.group({ p: [0, len - 0.02, 0], r: [0, spin, 0] }, () => {
      const g = geo.profileZY([[-0.016, -0.03], [0.04, -0.074], [0.104, -0.048], [0.112, 0.03], [0.074, 0.06], [-0.016, 0.034]], 0.011);
      b.add(projectBox(g, faces(A, { px: 'blade', nx: 'blade', mirrorNx: true })), mat.metal, { gloss: 0.7 });
      rod(b, A, [0, -0.014, 0], [0, 0.014, 0], 0.014, 0.014, 6, mat.rustDark, {});
    });
  });
}

/** Vorschlaghammer: Stiel von a nach c, Kopf am Ende quer / sledgehammer: haft from a to c, head across at the end */
export function sledge(b: UvBuilder, A: AtlasLayout, a: V3, c: V3, band: ColorLike): void {
  rod(b, A, a, c, 0.0085, 0.0095, fine() ? 7 : 5, mat.wood);
  const d: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  b.group({ p: c, r: aimY(d) }, () => {
    box(b, A, [0.1, 0.05, 0.05], 0.008, { pz: 'blade', nz: 'blade' }, mat.dark, { gloss: 0.5 });
    box(b, A, [0.104, 0.014, 0.054], 0.003, {}, band, { gloss: 0.4 });
    if (fine()) for (const s of [-1, 1]) bead(b, A, [s * 0.05, 0, 0], 0.021, mix(mat.metalLight, mat.metal, 0.4), 8, { gloss: 0.8 }, [0.3, 1, 1]);
  });
}
