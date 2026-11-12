/**
 * Soldaten-Grundform und Infanterie-Einheiten / base soldier and infantry-type units.
 * Comic-Proportionen: grosser Kopf und Helm, kurze Beine. Blickrichtung +z.
 * Comic proportions: big head and helmet, short legs. Facing +z.
 */
import type { FactionId } from '../../data/balance';
import { Builder, geo, mix, rng, shade, type V3 } from './kit';
import { look, mat, type Look } from './look';

/** Schulterhoehe stehend / shoulder height standing */
export const SHOULDER_Y = 0.255;
export const KNEEL_DROP = 0.075;

export interface SoldierOpts {
  kneel?: boolean;
  /** Schulterrotation links/rechts [rx, ry, rz] / shoulder rotation */
  armL?: V3;
  armR?: V3;
  pack?: 'pack' | 'medbag' | 'none';
  armband?: boolean;
  coat?: boolean;
  hat?: 'fedora';
  seed?: number;
}

function arm(b: Builder, L: Look, side: 1 | -1, y: number, rot: V3, armband: boolean, sleeve = L.jacket) {
  b.group({ p: [side * 0.1, y, 0], r: rot }, () => {
    b.box(0.048, 0.125, 0.052, sleeve, [0, -0.055, 0]);
    b.box(0.042, 0.04, 0.045, mat.skin, [0, -0.125, 0]);
    if (armband) b.box(0.056, 0.024, 0.06, L.secondary, [0, -0.03, 0]);
    if (L.id === 'dravon') b.box(0.06, 0.016, 0.06, L.secondary, [0, 0.006, 0]); // Schulterstueck / shoulder board
  });
}

/** Kopfbedeckung je Fraktion / headgear per faction */
function headgear(b: Builder, f: FactionId, L: Look, hy: number, fedora: boolean) {
  const face = (glasses: boolean) => {
    b.box(0.105, 0.098, 0.1, mat.skin, [0, hy + 0.049, 0]);
    if (glasses) {
      b.box(0.09, 0.022, 0.012, mat.ink, [0, hy + 0.06, 0.05]);
    } else {
      b.box(0.014, 0.024, 0.008, mat.ink, [-0.024, hy + 0.058, 0.051]);
      b.box(0.014, 0.024, 0.008, mat.ink, [0.024, hy + 0.058, 0.051]);
    }
  };
  if (fedora) {
    face(true);
    b.cyl(0.088, 0.09, 0.012, 10, L.secondary, [0, hy + 0.095, 0]);
    b.cyl(0.05, 0.058, 0.06, 8, L.secondary, [0, hy + 0.13, 0]);
    b.cyl(0.059, 0.06, 0.016, 8, L.primaryDark, [0, hy + 0.11, 0]);
    return;
  }
  switch (f) {
    case 'korvat':
      // runder Stahlhelm mit Krempe / round steel helmet with brim
      face(false);
      b.add(geo.hemi(0.08, 10, 3), L.helmet, { p: [0, hy + 0.072, -0.004], s: [1, 0.95, 1.05] });
      b.cyl(0.094, 0.096, 0.012, 10, shade(L.helmet, 0.8), [0, hy + 0.075, -0.004]);
      b.box(0.02, 0.012, 0.012, L.primary, [0, hy + 0.12, 0.068]);
      break;
    case 'dravon':
      // geschlossener Visierhelm, scharfkantig / closed visor helmet, sharp-edged
      b.add(geo.taper(0.125, 0.12, 0.1, 0.098, 0.13), L.helmet, { p: [0, hy + 0.065, 0] });
      b.add(geo.taper(0.1, 0.098, 0.02, 0.07, 0.03), L.helmet, { p: [0, hy + 0.145, 0] });
      b.box(0.105, 0.018, 0.012, L.secondary, [0, hy + 0.062, 0.061]);
      b.add(geo.taper(0.018, 0.12, 0.01, 0.1, 0.035), L.secondary, { p: [0, hy + 0.155, 0] });
      b.box(0.02, 0.04, 0.01, L.secondary, [0, hy + 0.03, 0.062]);
      break;
    case 'alvenia':
      // offener Helm mit Schutzbrille / open helmet with goggles
      face(false);
      b.add(geo.hemi(0.078, 10, 3), L.helmet, { p: [0, hy + 0.078, -0.004] });
      b.cyl(0.081, 0.082, 0.014, 10, L.secondary, [0, hy + 0.078, -0.004]);
      for (const x of [-0.026, 0.026]) {
        b.cyl(0.02, 0.02, 0.016, 8, L.secondary, [x, hy + 0.104, 0.066], [Math.PI / 2 - 0.3, 0, 0]);
        b.cyl(0.014, 0.014, 0.018, 8, mat.glass, [x, hy + 0.106, 0.069], [Math.PI / 2 - 0.3, 0, 0]);
      }
      break;
    case 'meridon':
      // Barett, schraeg / tilted beret
      face(false);
      b.box(0.108, 0.03, 0.06, mat.dark, [0, hy + 0.085, -0.025]);
      b.add(geo.sphere(0.072, 10, 5), L.helmet, { p: [0.012, hy + 0.104, -0.004], r: [0, 0, -0.22], s: [1.15, 0.42, 1.12] });
      b.box(0.022, 0.022, 0.01, L.primary, [-0.03, hy + 0.098, 0.074]);
      break;
    case 'velkar': {
      // Helm mit Visier und Antenne / helmet with visor and antenna
      face(false);
      b.add(geo.hemi(0.082, 10, 3), L.helmet, { p: [0, hy + 0.07, -0.006], s: [1, 1, 1.04] });
      b.cyl(0.085, 0.085, 0.02, 10, shade(L.helmet, 0.85), [0, hy + 0.07, -0.006]);
      b.add(geo.taper(0.115, 0.03, 0.11, 0.025, 0.04), mix(L.secondary, mat.glassDark, 0.45), { p: [0, hy + 0.06, 0.058] });
      b.cyl(0.02, 0.02, 0.03, 6, L.gear, [0.085, hy + 0.06, 0], [0, 0, Math.PI / 2]);
      b.tube([0.065, hy + 0.1, -0.03], [0.075, hy + 0.21, -0.045], 0.005, 4, mat.dark);
      b.add(geo.ico(0.013, 0), L.secondary, { p: [0.076, hy + 0.215, -0.046] });
      break;
    }
  }
}

/**
 * Soldat aufbauen (lokal: Fuesse auf y=0, Blick +z) / build a soldier (local: feet at y=0, facing +z).
 */
export function soldier(b: Builder, f: FactionId, o: SoldierOpts = {}): void {
  const L = look(f);
  const drop = o.kneel ? KNEEL_DROP : 0;
  const R = rng(o.seed ?? 1);
  // Beine / legs
  if (o.kneel) {
    // linkes Knie vorn, rechtes Knie am Boden / left knee up, right knee down
    b.box(0.058, 0.055, 0.11, L.pants, [-0.042, 0.075, 0.05]);
    b.box(0.058, 0.09, 0.06, L.pants, [-0.042, 0.045, 0.1]);
    b.box(0.064, 0.035, 0.09, mat.dark, [-0.042, 0.0175, 0.115]);
    b.box(0.058, 0.08, 0.06, L.pants, [0.042, 0.06, 0]);
    b.box(0.058, 0.04, 0.1, L.pants, [0.042, 0.02, -0.06]);
    b.box(0.062, 0.05, 0.03, mat.dark, [0.042, 0.025, -0.115]);
  } else if (o.coat) {
    for (const x of [-0.042, 0.042]) {
      b.box(0.056, 0.06, 0.06, L.pants, [x, 0.06, 0]);
      b.box(0.064, 0.035, 0.09, mat.dark, [x, 0.0175, 0.012]);
    }
  } else {
    for (const x of [-0.042, 0.042]) {
      b.box(0.06, 0.112, 0.065, L.pants, [x, 0.089, 0]);
      b.box(0.066, 0.036, 0.092, mat.dark, [x, 0.018, 0.012]);
    }
  }
  const y0 = 0.145 - drop;
  // Rumpf / torso
  if (o.coat) {
    const coat = L.primary;
    b.add(geo.taper(0.195, 0.135, 0.165, 0.104, 0.2), coat, { p: [0, 0.07 + 0.1 - drop, 0] });
    b.box(0.17, 0.022, 0.112, L.primaryDark, [0, 0.165 - drop, 0]);
    b.box(0.07, 0.05, 0.016, shade(coat, 0.85), [-0.035, 0.27 - drop, 0.05], [0.3, 0.2, -0.3]);
    b.box(0.07, 0.05, 0.016, shade(coat, 0.85), [0.035, 0.27 - drop, 0.05], [0.3, -0.2, 0.3]);
  } else {
    b.add(geo.taper(0.15, 0.09, 0.172, 0.102, 0.125), L.jacket, { p: [0, y0 + 0.0625, 0] });
    b.box(0.156, 0.026, 0.096, L.gear, [0, y0 + 0.008, 0]);
    if (f === 'meridon') {
      // leichte Weste / light vest
      b.add(geo.taper(0.158, 0.098, 0.176, 0.108, 0.085), L.secondary, { p: [0, y0 + 0.07, 0] });
      b.box(0.03, 0.03, 0.012, shade(L.secondary, 0.75), [-0.04, y0 + 0.055, 0.056]);
      b.box(0.03, 0.03, 0.012, shade(L.secondary, 0.75), [0.04, y0 + 0.055, 0.056]);
    }
    if (f === 'korvat') b.box(0.03, 0.12, 0.01, L.secondary, [0.03, y0 + 0.06, 0.05], [0, 0, 0.6]); // Riemen / strap
    if (f === 'velkar') {
      // Schneetarn-Flecken / snow camo patches
      for (let i = 0; i < 5; i++) {
        const side = R() < 0.5 ? -1 : 1;
        const onFront = R() < 0.6;
        const w = 0.03 + R() * 0.03;
        const h = 0.02 + R() * 0.025;
        const y = y0 + 0.02 + R() * 0.09;
        if (onFront) b.box(w, h, 0.008, mat.snow, [side * R() * 0.05, y, 0.052]);
        else b.box(0.008, h, w, mat.snow, [side * 0.083, y, (R() - 0.5) * 0.05]);
      }
      b.box(0.03, 0.025, 0.07, mat.snow, [0.042, 0.1 - drop * 0.5, 0.0]);
    }
  }
  // Rucksack / back pack
  if (o.pack === 'pack') b.add(geo.taper(0.12, 0.05, 0.11, 0.045, 0.1), L.gear, { p: [0, y0 + 0.07, -0.072] });
  if (o.pack === 'medbag') {
    b.add(geo.taper(0.15, 0.075, 0.14, 0.07, 0.13), mat.white, { p: [0, y0 + 0.075, -0.085] });
    b.box(0.156, 0.03, 0.08, L.primary, [0, y0 + 0.095, -0.085]);
    b.box(0.05, 0.03, 0.012, L.primary, [0, y0 + 0.095, -0.0465]);
  }
  // Arme / arms
  const sy = SHOULDER_Y - drop;
  const sleeve = o.coat ? L.primary : L.jacket;
  arm(b, L, -1, sy, o.armL ?? [0, 0, 0.12], !!o.armband, sleeve);
  arm(b, L, 1, sy, o.armR ?? [0, 0, -0.12], false, sleeve);
  // Kopf / head
  headgear(b, f, L, 0.268 - drop, o.hat === 'fedora');
}

// ---------- Waffen / weapons (entlang +z, Griff im Ursprung / along +z, grip at origin) ----------

export function rifle(b: Builder, len: number, opts: { scope?: boolean; heavy?: number } = {}): void {
  const k = opts.heavy ?? 1;
  b.box(0.026 * k, 0.042 * k, 0.085, mat.wood, [0, -0.008, -0.045]);
  b.box(0.03 * k, 0.038 * k, 0.11, mat.dark, [0, 0, 0.05]);
  b.box(0.022 * k, 0.045, 0.024, mat.dark, [0, -0.035, 0.06]);
  b.box(0.014 * k, 0.014 * k, len - 0.1, mat.metal, [0, 0.008, 0.1 + (len - 0.1) / 2]);
  if (opts.scope) {
    b.cyl(0.014, 0.014, 0.085, 6, mat.ink, [0, 0.036, 0.06], [Math.PI / 2, 0, 0]);
    b.cyl(0.018, 0.018, 0.012, 6, mat.ink, [0, 0.036, 0.105], [Math.PI / 2, 0, 0]);
  }
}

// ---------- Einheiten / units ----------

export function infantry(f: FactionId): Builder {
  const b = new Builder();
  soldier(b, f, { armL: [-1.15, 0, 0.42], armR: [-0.85, 0, -0.18], pack: 'pack', seed: 11 });
  b.group({ p: [0.035, 0.19, 0.05], r: [-0.22, -0.12, 0] }, () => rifle(b, 0.27));
  return b;
}

export function sniper(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  b.group({ p: [0, 0, -0.1] }, () => {
    soldier(b, f, { kneel: true, armL: [-1.45, 0, 0.5], armR: [-1.3, 0, -0.1], seed: 23 });
    // langes Gewehr an der Schulter / long rifle at the shoulder
    b.group({ p: [0.045, 0.19, 0.03], r: [-0.04, 0, 0] }, () => {
      rifle(b, 0.42, { scope: true });
      b.tube([0, 0, 0.36], [0.05, -0.19, 0.42], 0.005, 4, mat.dark);
      b.tube([0, 0, 0.36], [-0.05, -0.19, 0.42], 0.005, 4, mat.dark);
    });
    // Ghillie-Umhang / ghillie cape
    const R = rng(77);
    const tones = [mat.leaf, mat.leafDark, mat.grass, mix(mat.leaf, L.primary, 0.25)];
    const spots: V3[] = [
      [-0.06, 0.24, -0.06], [0.06, 0.24, -0.06], [0, 0.2, -0.08], [-0.08, 0.17, -0.05], [0.08, 0.17, -0.05],
      [0, 0.14, -0.08], [-0.05, 0.12, -0.07], [0.05, 0.12, -0.07], [0.1, 0.22, 0.0], [-0.1, 0.22, 0.0],
      [-0.04, 0.33, -0.04], [0.045, 0.32, -0.05],
    ];
    spots.forEach((p, i) => {
      b.add(geo.ico(0.034 + R() * 0.018, 0), tones[i % tones.length], {
        p: [p[0] + (R() - 0.5) * 0.02, p[1], p[2]], r: [R() * 3, R() * 3, R() * 3], s: [1, 0.75, 1],
      });
    });
    // Fraktionsfarbe als Tarnband / faction colour as camouflage band
    b.box(0.17, 0.024, 0.11, L.secondary, [0, 0.07 + 0.075, 0]);
  });
  return b;
}

function sandbag(b: Builder, x: number, y: number, z: number, ry: number) {
  b.add(geo.taper(0.115, 0.07, 0.095, 0.05, 0.045), mat.sandbag, { p: [x, y + 0.0225, z], r: [0, ry, 0] });
}

export function pioneer(f: FactionId): Builder {
  const b = new Builder();
  b.group({ p: [-0.02, 0, -0.1] }, () => {
    soldier(b, f, { armL: [-0.5, 0, 0.25], armR: [-0.25, 0, -0.42], pack: 'pack', seed: 31 });
    // Schaufel / shovel
    b.box(0.016, 0.21, 0.016, mat.wood, [0.16, 0.11, 0.06]);
    b.box(0.06, 0.014, 0.014, mat.wood, [0.16, 0.215, 0.06]);
    b.add(geo.taper(0.065, 0.012, 0.05, 0.012, 0.075), mat.metalLight, { p: [0.16, 0.03, 0.06] });
  });
  // Sandsackwall / sandbag wall
  sandbag(b, -0.12, 0, 0.2, 0.25);
  sandbag(b, 0, 0, 0.22, 0);
  sandbag(b, 0.12, 0, 0.2, -0.25);
  sandbag(b, -0.06, 0.045, 0.21, 0.12);
  sandbag(b, 0.06, 0.045, 0.21, -0.12);
  sandbag(b, 0.22, 0, 0.1, -0.9);
  return b;
}

export function mgTeam(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  // Dreibein + schweres MG / tripod + heavy MG
  b.group({ p: [0, 0, 0.1] }, () => {
    b.tube([0, 0.12, 0.02], [0.08, 0, 0.1], 0.008, 4, mat.dark);
    b.tube([0, 0.12, 0.02], [-0.08, 0, 0.1], 0.008, 4, mat.dark);
    b.tube([0, 0.12, 0.02], [0, 0, -0.1], 0.008, 4, mat.dark);
    b.box(0.05, 0.05, 0.13, mat.dark, [0, 0.145, 0.0]);
    b.cyl(0.02, 0.02, 0.17, 8, mat.metal, [0, 0.15, 0.15], [Math.PI / 2, 0, 0]);
    b.cyl(0.026, 0.026, 0.02, 8, mat.dark, [0, 0.15, 0.1], [Math.PI / 2, 0, 0]);
    b.cyl(0.026, 0.026, 0.02, 8, mat.dark, [0, 0.15, 0.2], [Math.PI / 2, 0, 0]);
    b.cyl(0.008, 0.008, 0.06, 6, mat.ink, [0, 0.15, 0.26], [Math.PI / 2, 0, 0]);
    b.box(0.13, 0.085, 0.012, L.primary, [0, 0.165, 0.055], [-0.15, 0, 0]);
    b.box(0.07, 0.05, 0.05, L.gear, [0.08, 0.025, -0.02]);
    b.box(0.012, 0.08, 0.012, mat.yellow, [0.05, 0.08, -0.02], [0, 0, 0.6]);
  });
  // Schuetze kniend / gunner kneeling
  b.group({ p: [0, 0, -0.1] }, () => soldier(b, f, { kneel: true, armL: [-1.25, 0, 0.35], armR: [-1.25, 0, -0.35], seed: 41 }));
  // Ladeschuetze / loader
  if (!lite) b.group({ p: [-0.2, 0, -0.04], r: [0, 0.8, 0] }, () => {
    soldier(b, f, { kneel: true, armL: [-0.9, 0, 0.3], armR: [-0.9, 0, -0.3], pack: 'pack', seed: 43 });
    b.box(0.07, 0.05, 0.05, L.gear, [0, 0.13, 0.12]);
  });
  return b;
}

export function medic(f: FactionId): Builder {
  const b = new Builder();
  const L = look(f);
  soldier(b, f, { armL: [-0.35, 0, 0.18], armR: [-0.15, 0, -0.2], pack: 'medbag', armband: true, seed: 51 });
  // Umhaengetasche mit Riemen (keine Schutzzeichen) / shoulder satchel with strap (no protective emblems)
  b.box(0.018, 0.2, 0.012, mat.white, [0.0, 0.205, 0.052], [0, 0, 0.75]);
  b.box(0.04, 0.07, 0.085, mat.white, [-0.098, 0.145, 0.0]);
  b.box(0.042, 0.02, 0.087, L.primary, [-0.098, 0.16, 0.0]);
  // weisser Koffer in der Hand / white case in hand
  b.box(0.075, 0.06, 0.032, mat.white, [0.118, 0.09, 0.03]);
  b.box(0.03, 0.012, 0.01, L.secondary, [0.118, 0.125, 0.03]);
  b.box(0.077, 0.014, 0.034, L.primary, [0.118, 0.09, 0.03]);
  return b;
}

export function spy(f: FactionId): Builder {
  const b = new Builder();
  soldier(b, f, { coat: true, hat: 'fedora', armL: [-0.15, 0, 0.12], armR: [0.1, 0, -0.15], seed: 61 });
  // Aktentasche / briefcase
  b.box(0.022, 0.065, 0.085, mat.dark, [0.125, 0.085, -0.02]);
  b.box(0.008, 0.012, 0.03, mat.gold, [0.125, 0.123, -0.02]);
  return b;
}
