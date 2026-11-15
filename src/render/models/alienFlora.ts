/**
 * Heimatwelt der Zyrr (Thema 'alien'): grosse fremde Pflanzen statt Baeumen, Kristalltuerme statt Bergen,
 * schwebende Felsen und kleine Fremdtiere. Nur Darstellung, eigene Schoepfung.
 * Zyrr homeworld (theme 'alien'): big strange plants instead of trees, crystal spires instead of mountains,
 * floating rocks and small alien critters. Render only, own creation.
 * Kachel 1x1, Ursprung unten mittig / tile 1x1, origin bottom centre.
 */
import { semantic } from '../../design/tokens';
import { Builder, col, geo, mix, rng, shade, type V3 } from './kit';
import { mat } from './look';
import { crystal, tendril } from './xeno';

const HALF_PI = Math.PI / 2;
/** Farben der Alienwelt aus den Tokens / alien world colours from the tokens */
const A = {
  ground: col(semantic.alienGround),
  groundDark: col(semantic.alienGroundDark),
  moss: col(semantic.alienMoss),
  crystal: col(semantic.alienCrystal),
  crystalDark: col(semantic.alienCrystalDark),
  rock: col(semantic.alienRock),
  rockDark: col(semantic.alienRockDark),
  moon: col(semantic.alienMoon),
};

/**
 * Grosse Pflanzen (4 Varianten): Knollenstiele, Spiralwedel, Leuchtkapsel-Schirm, Orgelpfeifen.
 * Big plants (4 variants): bulbous stalks, spiral fronds, glowing-pod umbrella, organ pipes.
 */
export function alienPlant(variant: number): Builder {
  const v = ((variant % 4) + 4) % 4;
  const R = rng(900 + v * 37);
  const b = new Builder();
  const glow = mat.xenoGlow, acid = mat.acid;
  if (v === 0) {
    // Knollenstiele mit Leuchtkapseln / bulbous stalks with glowing pods
    const spots: [number, number, number][] = [[-0.16, -0.1, 0.62], [0.14, 0.05, 0.5], [-0.02, 0.2, 0.4]];
    spots.forEach(([x, z, h], i) => {
      let y = 0;
      const lean = (R() - 0.5) * 0.12;
      for (let k = 0; k < 3; k++) {
        const y1 = y + h / 3;
        b.tube([x + lean * (y / h), y, z], [x + lean * (y1 / h), y1, z], 0.022 - k * 0.004, 7, mix(A.moss, A.groundDark, 0.3 + k * 0.1), 0.018 - k * 0.004);
        // Knolle am Gelenk / bulb at the joint
        b.add(geo.sphere(0.05 - k * 0.01, 10, 7), k === 2 ? glow : mix(A.moss, A.ground, 0.4), { p: [x + lean * (y1 / h), y1, z], s: [1, 1.3, 1] });
        y = y1;
      }
      b.add(geo.sphere(0.02, 8, 5), i % 2 ? acid : mix(glow, mat.white, 0.4), { p: [x + lean, y + 0.06, z] });
    });
  } else if (v === 1) {
    // Spiralwedel um einen Stamm / spiral fronds around a trunk
    const h = 0.72;
    b.tube([0, 0, 0], [0.02, h, -0.01], 0.04, 9, mix(A.groundDark, A.crystalDark, 0.3), 0.012);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = t * Math.PI * 3.2;
      const y = 0.12 + t * (h - 0.12);
      const len = 0.26 - t * 0.13;
      b.add(geo.sphere(1, 10, 6), i % 2 ? mix(A.crystal, A.moss, 0.35) : mix(A.crystalDark, A.moss, 0.25), {
        p: [Math.cos(a) * len * 0.55, y, Math.sin(a) * len * 0.55], s: [len * 0.6, 0.014, 0.06], r: [0, -a, 0.35 - t * 0.2],
      });
    }
    // eingerollte Spitze / curled tip
    let prev: V3 = [0.02, h, -0.01];
    for (let k = 1; k <= 8; k++) {
      const a = k * 0.75, r = 0.08 * (1 - k / 10);
      const p: V3 = [0.02 + Math.cos(a) * r, h + 0.02 + Math.sin(a) * r * 0.9, -0.01 + Math.sin(a) * 0.02];
      b.tube(prev, p, 0.012 - k * 0.001, 6, mix(A.crystalDark, A.moss, 0.4));
      prev = p;
    }
    b.add(geo.ico(0.022, 0), glow, { p: prev });
  } else if (v === 2) {
    // Schirm mit haengenden Leuchtkapseln / umbrella with hanging glowing pods
    b.tube([0, 0, 0], [0.03, 0.42, 0], 0.06, 10, mix(A.groundDark, A.moss, 0.25), 0.035);
    b.add(geo.torus(0.06, 0.012, 4, 14), acid, { p: [0, 0.06, 0], r: [HALF_PI, 0, 0] });
    b.add(geo.hemi(0.3, 18, 6), A.moss, { p: [0.03, 0.42, 0], s: [1, 0.42, 1] });
    b.add(geo.sphere(0.29, 18, 6), shade(A.moss, 0.6), { p: [0.03, 0.42, 0], s: [1, 0.08, 1] });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = 0.12 + (i % 2) * 0.1;
      const top: V3 = [0.03 + Math.cos(a) * r, 0.41, Math.sin(a) * r];
      const end: V3 = [top[0], 0.26 - (i % 3) * 0.04, top[2]];
      b.tube(top, end, 0.006, 4, shade(A.moss, 0.7));
      b.add(geo.sphere(0.03, 8, 6), i % 2 ? glow : acid, { p: end, s: [1, 1.3, 1] });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(geo.sphere(0.03, 8, 5), mix(A.ground, mat.white, 0.25), { p: [0.03 + Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2], s: [1, 0.5, 1] });
    }
  } else {
    // Orgelpfeifen mit leuchtenden Raendern / organ pipes with glowing rims
    for (let i = 0; i < 7; i++) {
      const a = R() * Math.PI * 2, d = R() * 0.22;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const h = 0.2 + R() * 0.45, r = 0.035 + R() * 0.03;
      b.cyl(r * 0.85, r, h, 10, i % 2 ? mix(A.ground, A.moss, 0.5) : mix(A.crystalDark, A.ground, 0.4), [x, h / 2, z], [(R() - 0.5) * 0.2, 0, (R() - 0.5) * 0.2]);
      b.add(geo.torus(r * 0.85, 0.009, 4, 12), i % 3 ? glow : acid, { p: [x, h, z], r: [HALF_PI, 0, 0] });
      b.add(geo.sphere(r * 0.6, 8, 4), shade(A.groundDark, 0.6), { p: [x, h - 0.005, z], s: [1, 0.3, 1] });
    }
  }
  // Wurzelranken am Boden / root tendrils on the ground
  for (let i = 0; i < 3; i++) {
    const a = R() * Math.PI * 2;
    tendril(b, [0, 0.01, 0], [Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15], [Math.cos(a + 0.4) * 0.3, 0.005, Math.sin(a + 0.4) * 0.3], 0.016, 0.004, 4, A.groundDark, null);
  }
  return b;
}

/**
 * Kristallturm statt Berggipfel (3 Varianten), Hoehe etwa 0.55 bis 0.75 vor der Berg-Skalierung.
 * Crystal spire instead of a mountain peak (3 variants), about 0.55 to 0.75 tall before the mountain scale.
 */
export function crystalSpire(variant: number): Builder {
  const v = ((variant % 3) + 3) % 3;
  const R = rng(1300 + v * 53);
  const b = new Builder();
  // Sockel aus dunklem Gestein / base of dark rock
  b.add(geo.dodeca(0.3), A.rockDark, { p: [0, 0.04, 0], s: [1.15, 0.35, 1.1] });
  const main = 0.55 + v * 0.1;
  const tilt = (R() - 0.5) * 0.15;
  b.group({ p: [0, 0, 0], r: [tilt, R() * 3, -tilt] }, () => {
    b.add(geo.cyl(0.07, 0.14, main * 0.75, 6), A.crystalDark, { p: [0, main * 0.375, 0] });
    b.add(geo.cone(0.07, main * 0.3, 6), A.crystal, { p: [0, main * 0.9, 0] });
    b.add(geo.cone(0.03, 0.09, 6), mat.xenoGlow, { p: [0, main * 1.06, 0] });
  });
  // Nebenkristalle / satellite crystals
  for (let i = 0; i < 5 + v; i++) {
    const a = (i / (5 + v)) * Math.PI * 2 + R();
    const d = 0.13 + R() * 0.12;
    crystal(b, Math.cos(a) * d, Math.sin(a) * d, 0.16 + R() * 0.24, 0.035 + R() * 0.025, i % 3 === 0 ? mat.xenoGlow : i % 2 ? A.crystal : A.crystalDark,
      [Math.sin(a) * 0.45, R() * 3, -Math.cos(a) * 0.45]);
  }
  return b;
}

/**
 * Schwebender Fels (3 Varianten): Felsbrocken mit Moos, Kristallen oder Pflanze oben und leuchtenden Ranken unten.
 * Floating rock (3 variants): boulder with moss, crystals or a plant on top and glowing tendrils below.
 */
export function floatingRock(variant: number): Builder {
  const v = ((variant % 3) + 3) % 3;
  const R = rng(1700 + v * 71);
  const b = new Builder();
  const w = 0.32 + v * 0.06;
  // kantiger Brocken: Oberseite flach, Unterseite spitz, Felskanten / jagged chunk: flat top, pointed underside, rock edges
  b.add(geo.dodeca(w), A.rock, { p: [0, 0, 0], s: [1, 0.55, 0.9], r: [0, R() * 2, 0] });
  b.add(geo.dodeca(w * 0.6), shade(A.rock, 1.2), { p: [-w * 0.35, w * 0.12, w * 0.2], s: [1, 0.7, 1], r: [0.4, 0, 0.3] });
  b.add(geo.cone(w * 0.85, w * 1.5, 7), A.rockDark, { p: [0, -w * 0.9, 0], r: [Math.PI, R() * 2, 0] });
  b.add(geo.cone(w * 0.4, w * 0.8, 5), A.rockDark, { p: [w * 0.4, -w * 0.55, w * 0.1], r: [Math.PI, 0.5, 0.2] });
  for (let i = 0; i < 3; i++) b.add(geo.cone(0.05, 0.12, 5), mix(A.crystal, A.rock, 0.3), { p: [Math.cos(i * 2.1) * w * 0.7, -w * 0.25, Math.sin(i * 2.1) * w * 0.6], r: [Math.PI - 0.5, i * 2.1, 0.4] });
  // Mooskappe nur auf einem Teil / moss cap on part of the top only
  b.add(geo.hemi(w * 0.55, 12, 4), mix(A.moss, A.rock, 0.35), { p: [w * 0.2, w * 0.3, -w * 0.1], s: [1, 0.3, 0.9] });
  if (v === 0) {
    for (let i = 0; i < 4; i++) crystal(b, (R() - 0.5) * w, (R() - 0.5) * w * 0.6, 0.14 + R() * 0.16, 0.03, i % 2 ? A.crystal : mat.xenoGlow, [(R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.6]);
  } else if (v === 1) {
    // kleine Spiralpflanze oben / small spiral plant on top
    b.group({ p: [0, w * 0.24, 0], s: 0.45 }, () => { alienPlantInto(b, 1); });
  } else {
    for (let i = 0; i < 4; i++) {
      const x = (R() - 0.5) * w, z = (R() - 0.5) * w * 0.6;
      b.tube([x, w * 0.22, z], [x, w * 0.22 + 0.1, z], 0.008, 5, A.groundDark);
      b.add(geo.sphere(0.03, 8, 5), mat.acid, { p: [x, w * 0.22 + 0.12, z] });
    }
  }
  // haengende Leuchtranken / hanging glowing tendrils
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + R();
    const r = w * 0.55;
    tendril(b, [Math.cos(a) * r, -w * 0.15, Math.sin(a) * r * 0.8], [Math.cos(a) * r * 1.1, -w * 0.6, Math.sin(a) * r], [Math.cos(a + 0.4) * r * 0.9, -w * (1 + R() * 0.6), Math.sin(a + 0.4) * r * 0.8], 0.012, 0.004, 5, A.groundDark, i % 2 ? mat.xenoGlow : mat.acid);
  }
  return b;
}

/** Pflanze in einen bestehenden Builder zeichnen / draw a plant into an existing builder */
function alienPlantInto(b: Builder, v: number) {
  const g = alienPlant(v).build();
  b.addColored(g);
}

// ---------- Fremdtiere / alien critters ----------

/** Qualle: Kuppel mit Tentakeln, schwebt / jelly: dome with tentacles, floats */
export function alienJelly(): Builder {
  const b = new Builder();
  b.add(geo.hemi(0.07, 14, 5), mix(A.crystal, mat.white, 0.2), { p: [0, 0.06, 0], s: [1, 0.8, 1] });
  b.add(geo.sphere(0.035, 10, 6), mat.xenoGlow, { p: [0, 0.075, 0] });
  b.add(geo.torus(0.068, 0.006, 4, 16), mat.acid, { p: [0, 0.06, 0], r: [HALF_PI, 0, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    tendril(b, [Math.cos(a) * 0.05, 0.06, Math.sin(a) * 0.05], [Math.cos(a) * 0.06, 0.0, Math.sin(a) * 0.06], [Math.cos(a + 0.5) * 0.04, -0.07, Math.sin(a + 0.5) * 0.04], 0.006, 0.002, 4, mix(A.crystalDark, mat.white, 0.3), null);
  }
  return b;
}

/** Sechsbeiniger Grasfresser / six-legged grazer */
export function alienGrazer(): Builder {
  const b = new Builder();
  // Koerper und Panzerbuckel / body and shell hump
  b.add(geo.sphere(0.05, 12, 8), mix(A.moss, A.ground, 0.3), { p: [0, 0.06, 0], s: [0.8, 0.65, 1.25] });
  b.add(geo.sphere(0.045, 12, 6), mix(A.crystalDark, A.moss, 0.4), { p: [0, 0.08, -0.01], s: [0.75, 0.5, 1.1] });
  for (let i = 0; i < 3; i++) b.add(geo.torus(0.03, 0.004, 3, 10), mat.acid, { p: [0, 0.095, -0.03 + i * 0.025], r: [0, 0, 0], s: [1, 0.5, 1] });
  // Kopf mit Fuehlern und drei Augen / head with antennae and three eyes
  b.add(geo.sphere(0.026, 10, 6), A.moss, { p: [0, 0.07, 0.065] });
  for (const s of [-1, 1]) b.tube([s * 0.01, 0.09, 0.07], [s * 0.03, 0.13, 0.09], 0.003, 4, A.groundDark);
  for (const s of [-1, 1]) b.add(geo.sphere(0.007, 6, 4), mat.xenoGlow, { p: [s * 0.03, 0.13, 0.09] });
  for (const x of [-0.011, 0, 0.011]) b.add(geo.sphere(0.006, 6, 4), mat.acid, { p: [x, 0.078, 0.088] });
  // sechs Beine / six legs
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const z = -0.035 + k * 0.035;
    const knee: V3 = [s * 0.06, 0.07, z + 0.005];
    b.tube([s * 0.03, 0.06, z], knee, 0.005, 4, A.groundDark);
    b.tube(knee, [s * 0.07, 0.0, z + 0.01], 0.004, 4, A.groundDark, 0.002);
  }
  return b;
}

/** Leuchtinsekt (winzig, fuer den Bloom) / glowing insect (tiny, for the bloom) */
export function alienInsect(): Builder {
  const b = new Builder();
  b.add(geo.ico(0.012, 0), mat.acid, { p: [0, 0, 0] });
  for (const s of [-1, 1]) b.add(geo.sphere(0.012, 6, 3), mix(mat.white, A.crystal, 0.4), { p: [s * 0.012, 0.006, 0], s: [1, 0.2, 0.6] });
  return b;
}
