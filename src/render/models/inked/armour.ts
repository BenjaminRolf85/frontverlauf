/**
 * Gezeichnete Figur: Ruestung und Zubehoer der Fraktionen als eigene Formen mit Zeichnung (armourPaint.ts).
 * Inked figure: faction armour and accessories as shapes of their own with drawing (armourPaint.ts).
 *
 * Bisher kamen Brustplatte, Wappenrock, Umhang und Schulterstuecke der Alvenia, Brustplatte und Generator der Velkar,
 * die Platten der Dravon und die Weste der Meridon ueber die Bruecke (alte Quader, ohne Zeichnung). Jetzt sind es
 * Schalen, die dem Rumpf folgen (figkit.shellRows): die Rueckseite einer Brustplatte steckt im Koerper, sichtbar ist
 * nur die Platte vorn. Alle Masse im Rahmen des Oberkoerpers der Figur (Baugroesse).
 * Until now the Alvenia chest plate, tabard, cape and pauldrons, the Velkar chest plate and generator, the Dravon
 * plates and the Meridon vest came through the bridge (old boxes, no drawing). Now they are shells following the torso
 * (figkit.shellRows): the back of a chest plate sits inside the body, only the plate in front is visible. All
 * dimensions in the frame of the figure's torso (build size).
 */
import * as THREE from 'three';
import type { FactionId } from '../../../data/balance';
import { FAITH } from '../alveniaFaith';
import { fine, shade, softBox, type ColorLike } from '../kit';
import { mat, type Look } from '../look';
import { TECH } from '../velkarTech';
import type { Detail } from './figure';
import { bead, box, cell, frontLoft, rod, shellRows, TIP } from './figkit';
import { AtlasLayout, loft, loftAt, projectBox, UvBuilder, type Ring } from './uvkit';

/** Zeilen der Brustplatten (Hoehe im Rumpf, Abstand) / rows of the chest plates (height on the torso, distance) */
export const PLATE = {
  alvenia: { top: 0.152, bottom: 0.06, width: 0.067 },
  velkar: { top: 0.15, bottom: 0.066, width: 0.062 },
  dravon: { top: 0.146, bottom: 0.096, width: 0.05 },
};
/** Weste der Meridon: von der Schulter bis ueber das Koppel / Meridon vest: from the shoulder to above the belt */
export const VEST = { top: 0.153, bottom: 0.058 };

function plateRings(T: Ring[], top: number, bottom: number, width: number, plate: ColorLike, trim: ColorLike | null, g = 0.0065): Ring[] {
  const edge = shade(plate, 0.55);
  const rows = trim
    ? [
      { y: top, g: g - 0.012, c: trim }, { y: top - 0.001, g, hard: true }, { y: top - 0.009, g, hard: true },
      { y: top - 0.0095, g: g - 0.0008, c: plate, hard: true }, { y: (top + bottom) / 2, g: g + 0.001 }, { y: bottom + 0.0085, g: g - 0.0008, hard: true },
      { y: bottom + 0.008, g, c: trim, hard: true }, { y: bottom, g, hard: true }, { y: bottom, g: g - 0.012, c: edge },
    ]
    : [
      { y: top, g: g - 0.012, c: plate }, { y: top - 0.001, g, hard: true }, { y: (top + bottom) / 2, g: g + 0.001 },
      { y: bottom, g, hard: true }, { y: bottom, g: g - 0.012, c: edge },
    ];
  return shellRows(T, rows, { front: true, width, e: 3.2 });
}

/**
 * Ruestung am Oberkoerper (Rahmen des Oberkoerpers): gibt zurueck, ob der Ruecken belegt ist (Umhang oder Generator).
 * Armour on the torso (torso frame): returns whether the back is taken (cape or generator).
 */
export function torsoArmour(b: UvBuilder, A: AtlasLayout, f: FactionId | null, L: Look, d: Detail, T: Ring[], seg: number, back: boolean): boolean {
  const hi = fine();
  switch (f) {
    case 'alvenia': {
      const P = PLATE.alvenia;
      b.add(frontLoft(plateRings(T, P.top, P.bottom, P.width, FAITH.plate, FAITH.gold), { seg, region: cell(A, 'plate:alvenia') }), null, { gloss: 0.25 });
      // tuerkise Leuchte unter dem Stern / teal light below the star
      if (d === 2) { const q = loftAt(T, 0.5, 0.086); bead(b, A, [q.p.x, q.p.y, q.p.z + 0.008], 0.0058, FAITH.tech, 6, { gloss: 1 }, [1.6, 0.8, 0.5]); }
      if (back) cape(b, A, d, seg);
      return back;
    }
    case 'velkar': {
      const P = PLATE.velkar;
      b.add(frontLoft(plateRings(T, P.top, P.bottom, P.width, TECH.shell, null), { seg, region: cell(A, 'plate:velkar') }), null, { gloss: 0.25 });
      // Leuchtleiste / light strip
      const q = loftAt(T, 0.5, 0.127);
      b.add(softBox(0.062, 0.0085, 0.006, 0.002), TECH.glow, { xf: { p: [q.p.x, q.p.y, q.p.z + 0.0078] }, gloss: 1, crease: 0 });
      if (back) techPack(b, A, d);
      return back;
    }
    case 'dravon': {
      const P = PLATE.dravon;
      b.add(frontLoft(plateRings(T, P.top, P.bottom, P.width, L.secondary, null, 0.0055), { seg, region: cell(A, 'plate:dravon') }), null, { gloss: 0.4 });
      return false;
    }
    case 'meridon':
      vest(b, A, T, seg, L.secondary, d >= 1 && hi);
      return false;
    default:
      return false;
  }
}

/** Weste rundum in der Farbe c, dazu zwei Taschen (Rahmen des Oberkoerpers) / vest all around in the colour c, plus two pouches (torso frame) */
export function vest(b: UvBuilder, A: AtlasLayout, T: Ring[], seg: number, c: ColorLike, pouches: boolean): void {
  const g = 0.0075, edge = shade(c, 0.55);
  const rows = [
    { y: VEST.top, g: g - 0.012, c }, { y: VEST.top - 0.0015, g, hard: true }, { y: 0.122, g: g + 0.001 }, { y: 0.09, g: g + 0.001 },
    { y: VEST.bottom, g, hard: true }, { y: VEST.bottom, g: g - 0.012, c: edge },
  ];
  b.add(loft(shellRows(T, rows), { seg, region: cell(A, 'vest:meridon') }), null, { crease: 0.8 });
  if (pouches) for (const s of [-1, 1]) {
    const q = loftAt(T, 0.5 + s * 0.085, 0.076);
    box(b, A, [0.03, 0.03, 0.013], 0.004, { pz: 'pouch' }, shade(c, 0.78), { xf: { p: [q.p.x, q.p.y, q.p.z + 0.011], r: [0, s * 0.25, 0] } });
  }
}

/** Koenigsblauer Umhang mit weissem Kragen und Goldsaum (Rahmen des Oberkoerpers) / royal blue cape with a white collar and gold hem (torso frame) */
export function capeRings(): Ring[] {
  // gebaut mit der Schauseite nach +z und beim Einfuegen um 180 Grad gedreht: so liegt die Naht der Zelle innen
  // built with the show side towards +z and turned by 180 degrees when added: the cell's seam then lies inside
  const s = { e: 3.4 };
  const row = (y: number, rx: number, cz: number, thick: number, extra: Partial<Ring> = {}): Ring => ({ y, rx, rz: thick, rzB: 0.007, cz, ...s, ...extra });
  return [
    { y: 0.163, rx: TIP, cz: 0.05, c: FAITH.plate },
    row(0.16, 0.05, 0.05, 0.012),
    row(0.149, 0.079, 0.056, 0.016, { hard: true }),
    row(0.1485, 0.078, 0.056, 0.015, { hard: true, c: FAITH.cloth }),
    ...(fine() ? [row(0.09, 0.083, 0.061, 0.015)] : []),
    row(0.0, 0.085, 0.064, 0.017),
    ...(fine() ? [row(-0.09, 0.09, 0.07, 0.02)] : []),
    row(-0.128, 0.093, 0.073, 0.021, { hard: true }),
    row(-0.1285, 0.094, 0.073, 0.022, { hard: true, c: FAITH.gold }),
    row(-0.14, 0.094, 0.074, 0.022, { hard: true }),
    { y: -0.14, rx: TIP, cz: 0.07, c: shade(FAITH.cloth, 0.5) },
  ];
}
export const CAPE = { top: 0.163, hem: -0.14 };
function cape(b: UvBuilder, A: AtlasLayout, d: Detail, seg: number): void {
  b.add(loft(capeRings(), { seg: Math.max(8, seg - (d === 2 ? 4 : 6)), region: cell(A, 'cape:alvenia') }), null, { xf: { r: [0, Math.PI, 0] }, crease: 0.7 });
}

/** Wappenrock der Alvenia vorn und hinten (Beckenrahmen) / Alvenia tabard front and back (pelvis frame) */
export function tabard(b: UvBuilder, A: AtlasLayout, d: Detail): void {
  for (const z of [0.053, -0.052]) {
    const g = fine() ? softBox(0.098, 0.128, 0.008, 0.003) : new THREE.BoxGeometry(0.098, 0.128, 0.008).toNonIndexed();
    // nach unten leicht schmaler / slightly narrower towards the bottom
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * (0.92 + 0.08 * (pos.getY(i) / 0.128 + 0.5)));
    b.add(projectBox(g, { pz: cell(A, 'tabard:alvenia'), nz: cell(A, 'tabard:alvenia'), all: A.get('blank') }), FAITH.cloth, { xf: { p: [0, -0.085, z], r: [z > 0 ? -0.05 : 0.05, 0, 0] }, crease: 0.7 });
  }
  void d;
}

/** Generator-Rucksack der Velkar (Rahmen des Oberkoerpers) / Velkar generator backpack (torso frame) */
function techPack(b: UvBuilder, A: AtlasLayout, d: Detail): void {
  const y = 0.094, z = -0.08;
  box(b, A, [0.118, 0.112, 0.05], 0.012, { px: 'techSide', nx: 'techSide', mirrorNx: true }, TECH.gear, { xf: { p: [0, y, z] } });
  box(b, A, [0.106, 0.1, 0.03], 0.012, { nz: 'techPack' }, TECH.shell, { xf: { p: [0, y + 0.004, z - 0.03] }, gloss: 0.25 });
  // tuerkiser Kern im Fenster: Scheibe in Leuchtfarbe / teal core in its window: a disc in the glow colour
  rod(b, A, [0, y + 0.008, z - 0.043], [0, y + 0.008, z - 0.0475], 0.024, 0.022, fine() ? 12 : 8, TECH.glow, { gloss: 1 });
  // Antenne mit Leuchtspitze / antenna with a glowing tip
  rod(b, A, [0.045, y + 0.05, z - 0.01], [0.058, y + 0.172, z - 0.03], 0.0034, 0.002, 4, mat.dark);
  bead(b, A, [0.0585, y + 0.176, z - 0.0305], 0.0075, TECH.glow, 6, { gloss: 1 });
  // Kabel zur Huefte / cable to the hip
  if (d >= 1) {
    rod(b, A, [-0.05, y - 0.045, z - 0.01], [-0.082, 0.022, -0.022], 0.0055, 0.0055, 5, TECH.gearDark);
    rod(b, A, [-0.082, 0.022, -0.022], [-0.07, 0.016, 0.048], 0.0055, 0.0055, 5, TECH.gearDark);
  }
}

/**
 * Schulterstueck im Rahmen des Oberarms (Ursprung an der Schulter, +y zum Ellbogen).
 * Shoulder piece in the frame of the upper arm (origin at the shoulder, +y towards the elbow).
 */
export function pauldron(b: UvBuilder, A: AtlasLayout, f: FactionId | null, L: Look, d: Detail, side: number, seg: number): void {
  const cap = (plate: ColorLike, trim: ColorLike, r: number, len: number): Ring[] => [
    { y: -0.034, rx: TIP, c: plate }, { y: -0.03, rx: r * 0.5 }, { y: -0.018, rx: r * 0.86 }, { y: 0, rx: r }, { y: len, rx: r + 0.0005, hard: true },
    { y: len + 0.0005, rx: r + 0.002, hard: true, c: trim }, { y: len + 0.0075, rx: r + 0.002, hard: true }, { y: len + 0.0075, rx: r - 0.007, c: shade(plate, 0.5) },
  ];
  if (f === 'alvenia' && d >= 1) {
    b.add(loft(cap(FAITH.plate, FAITH.gold, 0.038, 0.016), { seg, region: A.get('blank') }), null, { gloss: 0.25 });
    if (d === 2) bead(b, A, [side * 0.03, 0.006, 0.022], 0.0058, FAITH.tech, 6, { gloss: 1 });
  } else if (f === 'velkar' && d >= 1) {
    b.add(loft(cap(TECH.shell, TECH.gear, 0.0365, 0.012), { seg, region: A.get('blank') }), null, { gloss: 0.25 });
    if (d === 2) bead(b, A, [side * 0.03, 0.004, 0.02], 0.0058, TECH.glow, 6, { gloss: 1 });
  } else if (f === 'dravon') {
    // Schulterklappe in Gold / shoulder board in gold
    box(b, A, [0.062, 0.014, 0.06], 0.004, { py: 'epaulette', ny: 'epaulette' }, L.secondary, { xf: { p: [0, -0.024, 0], r: [0, 0, 0] }, gloss: 0.3 });
  }
}
