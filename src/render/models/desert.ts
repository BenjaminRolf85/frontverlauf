/**
 * Welt der Vergessenen (Kartenthema 'desert'): Tafelberge und Felsnadeln statt Bergen, Felsboegen, Dornengestruepp und
 * Hoodoos statt Wald, Duenenrippel, Salzpfannen-Risse, verwitterte Verdan-Ruinen (Saeulen, halb versunkene Fluegelstatuen,
 * eingestuerzte Kuppeln), ausgebleichte Riesenskelette, die Ruinenstaetten (m13), der Hoehleneingang (m14) und kleine
 * Wuestentiere. Nichts Gruenes; Runen leuchten in den Artefakt-Farben (KEYS in atmosphere.ts). Nur Darstellung.
 * World of the Forgotten (map theme 'desert'): mesas and spires instead of mountains, rock arches, thorn scrub and
 * hoodoos instead of forest, dune ripples, salt-flat cracks, weathered Verdan ruins (pillars, half-buried winged statues,
 * collapsed domes), bleached giant skeletons, the ruin sites (m13), the cave entrance (m14) and small desert critters.
 * Nothing green; runes glow in the artifact colours (KEYS in atmosphere.ts). Render only.
 * Kachel 1x1, Ursprung unten mittig / tile 1x1, origin bottom centre.
 */
import type * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { factionTokens, semantic } from '../../design/tokens';
import { mat } from './look';
import { Builder, col, geo, memo, mix, rng, shade, type V3 } from './kit';
import { verdanEmblem } from './cavern';

const S = semantic;
const TAU = Math.PI * 2;
const wrap = (v: number, n: number) => ((Math.floor(v) % n) + n) % n;

// ---------- Nichts Gruenes / nothing green ----------

/**
 * Kopie einer Geometrie ohne Gruen: gruenstichige Vertexfarben (Moos, Baeume, Kisten) werden zu trockenem Dornbraun
 * bis Sand, die Helligkeit bleibt; Leuchtfarben bleiben unberuehrt (gecacht unter key).
 * Copy of a geometry without green: green-tinted vertex colours (moss, trees, crates) become dry thorn brown to sand,
 * brightness is kept; glow colours stay untouched (cached under key).
 */
export function sandify(src: THREE.BufferGeometry, key: string): THREE.BufferGeometry {
  return memo(`desert|sandify|${key}`, () => {
    const g = src.clone();
    const c = g.getAttribute('color');
    const dark = col(S.desertThornDark), light = col(S.desertSandLight), tmp = col(S.white);
    for (let i = 0; i < c.count; i++) {
      const r = c.getX(i), gg = c.getY(i), b = c.getZ(i);
      if (gg <= r * 1.04 || gg <= b * 1.04 || gg > 0.97) continue;
      const l = Math.min(1, (0.2126 * r + 0.7152 * gg + 0.0722 * b) * 1.4);
      tmp.copy(dark).lerp(light, l);
      c.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    g.deleteAttribute('glow');
    delete g.userData.glowTag;
    return g;
  });
}

// ---------- Tafelberge, Felsnadeln, Boegen / mesas, spires, arches ----------

/** Geschichtete Felsstufe (Schichtbaender) / layered rock tier (strata bands) */
function strata(b: Builder, x: number, z: number, w: number, d: number, y0: number, h: number, R: () => number, rot = 0) {
  const bands = [S.desertRockDark, S.desertRock, S.desertRockLight, S.desertRock, S.desertOchre];
  const n = 3 + Math.floor(R() * 2);
  let y = y0;
  for (let i = 0; i < n; i++) {
    const bh = h / n;
    const k = 1 - i * 0.05;
    b.add(geo.ctaper(w * k * 1.04, d * k * 1.04, w * k, d * k, bh, Math.min(w, d) * 0.18), bands[(i + Math.floor(R() * 2)) % bands.length], { p: [x, y + bh / 2, z], r: [0, rot, 0] });
    y += bh;
  }
  return y;
}

/**
 * Tafelberg, Felsnadel oder Felsbogen statt Berggipfel (4 Varianten).
 * Mesa, spire or rock arch instead of a mountain peak (4 variants).
 */
export function mesaGeometry(variant: number): THREE.BufferGeometry {
  const v = wrap(variant, 4);
  return memo(`desert|mesa|${v}`, () => {
    const R = rng(4400 + v * 41);
    const b = new Builder();
    // Schuttkegel am Fuss / scree cone at the foot
    b.add(geo.cyl(0.36, 0.46, 0.08, 9), S.desertScree, { p: [0, 0.04, 0] });
    if (v === 0) {
      // breiter Tafelberg mit flacher Kappe / broad mesa with a flat cap
      const top = strata(b, 0, 0, 0.62, 0.54, 0.06, 0.5, R, 0.3);
      b.add(geo.ctaper(0.62, 0.54, 0.6, 0.5, 0.05, 0.08), S.desertSandLight, { p: [0, top + 0.02, 0], r: [0, 0.3, 0] });
    } else if (v === 1) {
      // Felsnadel (Butte), schmal und hoch / spire (butte), narrow and tall
      const top = strata(b, 0.04, -0.02, 0.32, 0.3, 0.06, 0.72, R, 0.7);
      b.add(geo.cone(0.13, 0.14, 6), S.desertRockLight, { p: [0.04, top + 0.06, -0.02] });
      strata(b, -0.22, 0.18, 0.2, 0.18, 0.04, 0.26, R, 1.1);
    } else if (v === 2) {
      // Felsbogen / rock arch
      for (const sx of [-1, 1]) strata(b, sx * 0.26, 0, 0.2, 0.24, 0.05, 0.5, R, sx * 0.2);
      b.add(geo.rbox(0.74, 0.14, 0.26, 0.05), S.desertRockLight, { p: [0, 0.6, 0], r: [0, 0, 0.04] });
      b.add(geo.rbox(0.6, 0.06, 0.22, 0.03), S.desertRock, { p: [0, 0.52, 0] });
    } else {
      // zwei gestufte Tafeln / two stepped tables
      const top = strata(b, -0.1, -0.06, 0.48, 0.42, 0.06, 0.42, R, 0.1);
      b.add(geo.ctaper(0.48, 0.42, 0.46, 0.4, 0.04, 0.07), S.desertSandLight, { p: [-0.1, top + 0.02, -0.06], r: [0, 0.1, 0] });
      strata(b, 0.24, 0.24, 0.26, 0.24, 0.05, 0.26, R, 0.5);
    }
    // Felsbrocken / boulders
    for (let i = 0; i < 3; i++) {
      const a = R() * TAU;
      b.add(geo.dodeca(0.04 + R() * 0.04), i % 2 ? S.desertRockDark : S.desertScreeDark, { p: [Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38], r: [R(), R(), R()] });
    }
    return b.build();
  });
}

// ---------- Gestruepp und Hoodoos / scrub and hoodoos ----------

/** Dorniger, trockener Strauch / thorny dry shrub */
function thornBush(b: Builder, x: number, z: number, s: number, R: () => number) {
  const n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R() * 0.5;
    const h = (0.12 + R() * 0.1) * s;
    const tip: V3 = [x + Math.cos(a) * 0.08 * s, h, z + Math.sin(a) * 0.08 * s];
    b.tube([x, 0, z], tip, 0.006 * s, 4, i % 2 ? S.desertThorn : S.desertThornDark, 0.003 * s);
    // Dornen / thorns
    b.add(geo.cone(0.008 * s, 0.03 * s, 3), S.desertThornDark, { p: [tip[0], tip[1], tip[2]], r: [R() - 0.5, 0, R() - 0.5] });
  }
}

/** Hoodoo: Steinstapel mit Hut / hoodoo: stacked stones with a cap */
function hoodoo(b: Builder, x: number, z: number, h: number, R: () => number) {
  let y = 0;
  const parts = 3 + Math.floor(R() * 2);
  for (let i = 0; i < parts; i++) {
    const r = 0.05 - i * 0.006 + R() * 0.01;
    const ph = h / parts;
    b.add(geo.sphere(r, 7, 5), i % 2 ? S.desertRock : S.desertRockLight, { p: [x, y + ph / 2, z], s: [1, ph / (2 * r) * 1.1, 1] });
    y += ph;
  }
  b.add(geo.cyl(0.07, 0.06, 0.035, 7), S.desertRockDark, { p: [x, y + 0.012, z], r: [R() * 0.2, 0, R() * 0.2] });
}

/**
 * Dornengestruepp mit Hoodoos und Felsbrocken statt Wald (4 Varianten); low = weniger Teile.
 * Thorn scrub with hoodoos and boulders instead of forest (4 variants); low = fewer parts.
 */
export function thornScrubGeometry(variant: number, low = false): THREE.BufferGeometry {
  const v = wrap(variant, 4);
  return memo(`desert|scrub|${v}|${+low}`, () => {
    const R = rng(5100 + v * 29);
    const b = new Builder();
    const spots: [number, number][] = [[-0.22, -0.18], [0.2, -0.2], [0.02, 0.08], [-0.24, 0.22], [0.24, 0.24]];
    const n = low ? 2 : 3 + (v % 2);
    for (let i = 0; i < n; i++) { const [x, z] = spots[(i + v) % spots.length]; thornBush(b, x, z, 1 + R() * 0.5, R); }
    hoodoo(b, v % 2 ? 0.18 : -0.16, v < 2 ? 0.02 : -0.2, 0.28 + R() * 0.16, R);
    if (!low) hoodoo(b, -0.05, 0.28, 0.16 + R() * 0.1, R);
    for (let i = 0; i < (low ? 2 : 4); i++) {
      const a = R() * TAU, d = 0.15 + R() * 0.25;
      b.add(geo.dodeca(0.03 + R() * 0.04), i % 2 ? S.desertRockDark : S.desertScree, { p: [Math.cos(a) * d, 0.02, Math.sin(a) * d], r: [R(), R(), R()], s: [1, 0.7, 1] });
    }
    return b.build();
  });
}

// ---------- Boden / ground ----------

/**
 * Bodendeko der Ebene (8 Varianten, manche leer): Duenenrippel, Geroell, einzelner Dornbusch, Salzrisse.
 * salt = Salzpfanne (alter Meeresgrund).
 * Ground decoration of the plain (8 variants, some empty): dune ripples, scree, a single thorn bush, salt cracks.
 * salt = salt flat (old seabed).
 */
export function desertGroundDeco(variant: number, salt: boolean): THREE.BufferGeometry | null {
  const v = wrap(variant, 8);
  if (v === 3 || v === 6) return null;
  return memo(`desert|ground|${v}|${+salt}`, () => {
    const R = rng(5600 + v * 17 + (salt ? 500 : 0));
    const b = new Builder();
    if (salt) {
      // Salzkruste: helle Platten mit dunklen Fugen / salt crust: light plates with dark seams
      for (let i = 0; i < 5; i++) {
        const x = (R() - 0.5) * 0.7, z = (R() - 0.5) * 0.7;
        b.add(geo.cyl(0.09 + R() * 0.05, 0.1 + R() * 0.05, 0.012, 6), i % 2 ? S.desertSalt : S.desertSaltCrust, { p: [x, 0.006, z], r: [0, R() * TAU, 0] });
      }
      for (let i = 0; i < 4; i++) b.add(geo.box(0.32 + R() * 0.2, 0.008, 0.008), S.desertRockDeep, { p: [(R() - 0.5) * 0.5, 0.013, (R() - 0.5) * 0.5], r: [0, R() * TAU, 0] });
    } else if (v === 0 || v === 4 || v === 7) {
      // Duenenrippel / dune ripples
      for (let i = 0; i < 3; i++) {
        b.add(geo.sphere(1, 10, 4), i % 2 ? S.desertSandLight : S.desertOchre, { p: [(R() - 0.5) * 0.4, 0, -0.25 + i * 0.22], s: [0.32 + R() * 0.1, 0.035, 0.06], r: [0, 0.3 + (R() - 0.5) * 0.2, 0] });
      }
    } else if (v === 1 || v === 5) {
      // Geroell und ein Dornbusch / scree and a thorn bush
      for (let i = 0; i < 4; i++) b.add(geo.dodeca(0.025 + R() * 0.03), i % 2 ? S.desertRockDark : S.desertScree, { p: [(R() - 0.5) * 0.6, 0.015, (R() - 0.5) * 0.6], r: [R(), R(), R()] });
      thornBush(b, (R() - 0.5) * 0.4, (R() - 0.5) * 0.4, 0.8, R);
    } else {
      // flacher Felsbuckel / flat rock hump
      b.add(geo.sphere(1, 9, 5), S.desertRock, { p: [0.08, 0, -0.06], s: [0.2, 0.06, 0.15] });
      b.add(geo.dodeca(0.04), S.desertRockDark, { p: [-0.2, 0.02, 0.15], r: [R(), R(), R()] });
    }
    return b.build();
  });
}

// ---------- Verdan-Ruinen / Verdan ruins ----------

/** Geborstene Saeule; fallen = umgestuerzt / broken pillar; fallen = toppled */
function pillar(b: Builder, x: number, z: number, h: number, R: () => number, fallen = false) {
  const stone = mix(S.verdanStone, S.desertSandLight, 0.35), dark = mix(S.verdanStoneDark, S.desertRockDark, 0.3);
  if (fallen) {
    b.group({ p: [x, 0.05, z], r: [0, R() * TAU, Math.PI / 2] }, () => {
      for (let i = 0; i < 3; i++) b.add(geo.cyl(0.05, 0.05, h / 3 - 0.01, 8), i % 2 ? stone : dark, { p: [0, -h / 2 + (i + 0.5) * (h / 3), 0], r: [0, i * 0.3, (R() - 0.5) * 0.1] });
    });
    return;
  }
  b.add(geo.cbox(0.13, 0.04, 0.13, 0.02), dark, { p: [x, 0.02, z] });
  b.add(geo.cyl(0.048, 0.055, h, 8), stone, { p: [x, 0.04 + h / 2, z] });
  // Kanneluren als dunkle Streifen / flutes as dark stripes
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    b.add(geo.box(0.01, h * 0.8, 0.012), dark, { p: [x + Math.cos(a) * 0.05, 0.04 + h / 2, z + Math.sin(a) * 0.05], r: [0, -a, 0] });
  }
  // Bruchkante / broken top
  b.add(geo.cone(0.05, 0.05, 6), stone, { p: [x, 0.04 + h + 0.02, z], r: [R() * 0.6, 0, R() * 0.6] });
}

/** Halb versunkene Fluegelstatue mit dem Verdan-Wappen / half-buried winged statue with the Verdan emblem */
function wingedStatue(b: Builder, x: number, z: number, s: number, rot: number, runes: string | null) {
  const stone = mix(S.verdanStone, S.desertSandLight, 0.3), dark = mix(S.verdanStoneDark, S.desertRockDark, 0.25);
  b.group({ p: [x, 0, z], r: [0.18, rot, -0.12], s }, () => {
    // Sockel im Sand / plinth in the sand
    b.add(geo.cbox(0.24, 0.1, 0.18, 0.03), dark, { p: [0, 0.03, 0] });
    // Rumpf und Kopf / torso and head
    b.add(geo.ctaper(0.14, 0.1, 0.1, 0.08, 0.2, 0.02), stone, { p: [0, 0.18, 0] });
    b.add(geo.sphere(0.05, 8, 6), stone, { p: [0, 0.32, 0] });
    // Fluegel: gestufte Federn / wings: stepped feathers
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        b.add(geo.box(0.2 - k * 0.03, 0.035, 0.03), k % 2 ? stone : shade(stone, 0.9), {
          p: [side * (0.13 + k * 0.025), 0.26 - k * 0.04, -0.02], r: [0, 0, side * (0.55 - k * 0.1)],
        });
      }
    }
    // Wappen auf der Brust (rot-weiss, verblasst) / emblem on the chest (red and white, faded)
    b.group({ p: [0, 0.2, 0.05] }, () => verdanEmblem(b, 0.9));
    if (runes) for (let i = 0; i < 3; i++) b.add(geo.box(0.015, 0.05, 0.01), runes, { p: [-0.05 + i * 0.05, 0.05, 0.095] });
  });
}

/** Eingestuerzte Kuppel / collapsed dome */
function brokenDome(b: Builder, x: number, z: number, r: number, R: () => number) {
  const stone = mix(S.verdanStone, S.desertSandLight, 0.4);
  b.add(geo.cyl(r, r * 1.05, 0.08, 10), shade(stone, 0.85), { p: [x, 0.04, z] });
  // halbe Kuppelschale, schraeg eingesunken / half dome shell, sunk at an angle
  b.add(geo.hemi(r * 0.95, 10, 3), stone, { p: [x, 0.06, z], s: [1, 0.75, 0.55], r: [0.25, R() * TAU, 0] });
  for (let i = 0; i < 4; i++) {
    const a = R() * TAU;
    b.add(geo.dodeca(0.03 + R() * 0.03), shade(stone, 0.8 + R() * 0.3), { p: [x + Math.cos(a) * r * 1.2, 0.025, z + Math.sin(a) * r * 1.2], r: [R(), R(), R()] });
  }
}

/**
 * Verstreute Verdan-Ruine als Kulisse (4 Varianten): Saeulenreihe, Fluegelstatue, eingestuerzte Kuppel, Torbogen.
 * Scattered Verdan ruin as scenery (4 variants): row of pillars, winged statue, collapsed dome, gate arch.
 */
export function verdanDesertRuin(variant: number): THREE.BufferGeometry {
  const v = wrap(variant, 4);
  return memo(`desert|ruin|${v}`, () => {
    const R = rng(6100 + v * 23);
    const b = new Builder();
    if (v === 0) { pillar(b, -0.22, -0.1, 0.36, R); pillar(b, 0.02, -0.16, 0.22, R); pillar(b, 0.2, 0.12, 0.42, R, true); }
    else if (v === 1) { wingedStatue(b, 0, 0, 1, 0.4, null); pillar(b, 0.26, -0.22, 0.18, R); }
    else if (v === 2) { brokenDome(b, 0, 0, 0.26, R); pillar(b, -0.3, 0.26, 0.2, R); }
    else {
      const stone = mix(S.verdanStone, S.desertSandLight, 0.35);
      pillar(b, -0.2, 0, 0.4, R); pillar(b, 0.2, 0, 0.32, R);
      b.add(geo.rbox(0.36, 0.06, 0.12, 0.02), stone, { p: [-0.05, 0.47, 0], r: [0, 0, -0.3] });
    }
    return b.build();
  });
}

/**
 * Ruinenstaette der Vergessenen (m13, ein Feld): Saeulenkreis um eine Fluegelstatue auf einer Plattform; done = Runen leuchten.
 * Ruin site of the Forgotten (m13, one tile): ring of pillars around a winged statue on a platform; done = runes glow.
 */
export function ruinSiteGeometry(done: boolean): THREE.BufferGeometry {
  return memo(`desert|site|${+done}`, () => {
    const R = rng(6600);
    const b = new Builder();
    const stone = mix(S.verdanStone, S.desertSandLight, 0.3), dark = mix(S.verdanStoneDark, S.desertRockDark, 0.3);
    const rune = done ? S.artifactGlow : S.artifactObsidian;
    // Plattform mit Stufen / platform with steps
    b.add(geo.cbox(0.84, 0.05, 0.84, 0.14), dark, { p: [0, 0.025, 0] });
    b.add(geo.cbox(0.68, 0.05, 0.68, 0.12), stone, { p: [0, 0.075, 0] });
    // Runenring auf der Plattform / rune ring on the platform
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      b.add(geo.box(0.05, 0.008, 0.016), rune, { p: [Math.cos(a) * 0.27, 0.104, Math.sin(a) * 0.27], r: [0, -a, 0] });
    }
    b.group({ p: [0, 0.1, 0] }, () => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + 0.3;
        pillar(b, Math.cos(a) * 0.34, Math.sin(a) * 0.34, i % 3 === 1 ? 0.18 : 0.34 + R() * 0.1, R, i === 4);
      }
      wingedStatue(b, 0, 0, 1.7, 0, done ? S.artifactGlow : null);
      // Obelisk-Splitter mit Runen / obelisk shard with runes
      b.add(geo.cone(0.05, 0.22, 4), S.artifactObsidian, { p: [0.17, 0.11, 0.17], r: [0.1, 0.5, -0.2] });
      b.add(geo.box(0.012, 0.1, 0.01), rune, { p: [0.165, 0.1, 0.205], r: [0.1, 0.5, -0.2] });
    });
    return b.build();
  });
}

// ---------- Hoehleneingang / cave entrance ----------

/**
 * Hoehleneingang (m14): riesiger Felsschlund in einer Klippe, dunkle Oeffnung nach +z, Fluegelwappen darueber,
 * Treppenstufen und zwei geborstene Saeulen. Breiter als ein Feld, ragt nach hinten auf die Felswand.
 * Cave entrance (m14): huge rock maw in a cliff, dark opening towards +z, winged emblem above, steps and two broken
 * pillars. Wider than one tile, reaches back over the rock wall.
 */
export function caveMouthGeometry(): THREE.BufferGeometry {
  return memo('desert|caveMouth', () => {
    const R = rng(7300);
    const b = new Builder();
    // Klippe: geschichtete Felsmasse hinter dem Feld / cliff: layered rock mass behind the tile
    strata(b, 0, -0.62, 1.7, 0.9, 0, 1.15, R, 0);
    b.add(geo.hull([[-0.9, 0, -0.2], [0.9, 0, -0.2], [-0.8, 1.05, -0.35], [0.8, 1.05, -0.35], [-0.95, 0, -1.05], [0.95, 0, -1.05], [0, 1.4, -0.7]]), S.desertRock);
    b.add(geo.ctaper(1.6, 0.6, 1.4, 0.5, 0.06, 0.1), S.desertSandLight, { p: [0, 1.17, -0.62] });
    // Schlund: dunkle, gewoelbte Oeffnung / maw: dark vaulted opening
    b.add(geo.cyl(0.42, 0.42, 0.06, 14, false), S.desertRockDeep, { p: [0, 0.38, -0.17], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.25] });
    b.add(geo.cyl(0.36, 0.36, 0.08, 14, false), S.riftVoid, { p: [0, 0.34, -0.13], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.2] });
    b.add(geo.box(0.72, 0.36, 0.08), S.riftVoid, { p: [0, 0.18, -0.13] });
    // Rahmen aus Verdan-Steinen / frame of Verdan stones
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      b.add(geo.cbox(0.13, 0.1, 0.12, 0.02), i % 2 ? mix(S.verdanStone, S.desertSandLight, 0.3) : S.verdanStoneDark, {
        p: [Math.cos(a) * 0.46, 0.34 + Math.sin(a) * 0.52, -0.1], r: [0, 0, a - Math.PI / 2],
      });
    }
    // Wappen ueber dem Schlund / emblem above the maw
    b.group({ p: [0, 0.98, -0.12], s: 2.6 }, () => verdanEmblem(b, 1));
    // Treppe hinab / steps down
    for (let i = 0; i < 3; i++) b.add(geo.box(0.6 - i * 0.08, 0.03, 0.12), i % 2 ? S.verdanStoneDark : S.verdanStone, { p: [0, 0.015 + i * 0.012, 0.18 - i * 0.12] });
    // geborstene Saeulen zu beiden Seiten / broken pillars on both sides
    pillar(b, -0.5, 0.12, 0.5, R); pillar(b, 0.52, 0.08, 0.34, R);
    // Felsbrocken und Knochen davor / boulders and bones in front
    for (let i = 0; i < 5; i++) b.add(geo.dodeca(0.04 + R() * 0.05), i % 2 ? S.desertRockDark : S.desertRock, { p: [(R() - 0.5) * 1.2, 0.03, 0.2 + R() * 0.25], r: [R(), R(), R()] });
    b.add(geo.cyl(0.012, 0.012, 0.2, 5), S.desertBone, { p: [0.3, 0.02, 0.32], r: [0, 0.6, Math.PI / 2] });
    // kaltes Leuchten tief im Schlund (Runen der Vergessenen) / cold glow deep inside the maw (runes of the Forgotten)
    for (let i = 0; i < 3; i++) b.add(geo.box(0.04, 0.012, 0.01), S.artifactGlow, { p: [-0.12 + i * 0.12, 0.22 + (i % 2) * 0.08, -0.08] });
    return b.build();
  });
}

// ---------- Skelette und Tiere / skeletons and critters ----------

/**
 * Ausgebleichtes Riesenskelett (3 Varianten): Brustkorb aus Rippenboegen, Wirbelsaeule, Schaedel mit Hoernern.
 * Bleached giant skeleton (3 variants): ribcage of rib arcs, spine, skull with horns.
 */
export function giantSkeletonGeometry(variant: number): THREE.BufferGeometry {
  const v = wrap(variant, 3);
  return memo(`desert|skeleton|${v}`, () => {
    const R = rng(7800 + v * 13);
    const b = new Builder();
    const bone = S.desertBone, shadeB = S.desertBoneShade;
    const len = 0.55 + v * 0.08;
    // Wirbelsaeule / spine
    for (let i = 0; i < 9; i++) b.add(geo.sphere(0.025, 6, 4), i % 2 ? bone : shadeB, { p: [-len / 2 + (i / 8) * len, 0.03, 0], s: [1.2, 1, 1] });
    // Rippen als Boegen / ribs as arcs
    for (let i = 0; i < 6; i++) {
      const x = -len * 0.3 + i * len * 0.11, r = 0.17 - Math.abs(i - 2.5) * 0.02;
      b.add(geo.torus(r, 0.012, 4, 10), i % 2 ? bone : shadeB, { p: [x, 0.02, 0], r: [0, Math.PI / 2, 0], s: [1, 1, 1] });
    }
    // Schaedel / skull
    b.group({ p: [len / 2 + 0.06, 0.05, 0], r: [0, 0, -0.2] }, () => {
      b.add(geo.sphere(0.07, 8, 6), bone, { s: [1.5, 0.8, 1] });
      b.add(geo.sphere(0.02, 5, 4), S.desertRockDeep, { p: [0.04, 0.02, 0.045] });
      b.add(geo.sphere(0.02, 5, 4), S.desertRockDeep, { p: [0.04, 0.02, -0.045] });
      for (const sz of [-1, 1]) b.tube([-0.02, 0.04, sz * 0.05], [-0.1, 0.13, sz * 0.12], 0.012, 5, shadeB, 0.004);
    });
    // halb im Sand: Sandwehe davor / half in the sand: a sand drift in front
    b.add(geo.sphere(1, 8, 4), S.desertSandLight, { p: [(R() - 0.5) * 0.2, 0, 0.12], s: [0.3, 0.04, 0.1] });
    return b.build();
  });
}

/** Sandhuepfer: flacher Koerper mit sechs Beinen / sand skitterer: flat body with six legs */
export function skittererGeometry(): THREE.BufferGeometry {
  return memo('desert|skitterer', () => {
    const b = new Builder();
    b.add(geo.sphere(0.04, 8, 5), S.desertRock, { p: [0, 0.035, 0], s: [1.4, 0.55, 1] });
    b.add(geo.sphere(0.022, 6, 4), S.desertRockDark, { p: [0.055, 0.04, 0] });
    for (let i = 0; i < 3; i++) for (const sz of [-1, 1]) b.tube([-0.02 + i * 0.025, 0.03, sz * 0.02], [-0.03 + i * 0.03, 0, sz * 0.06], 0.005, 3, S.desertRockDeep);
    return b.build();
  });
}

/** Aasflieger mit breiten Schwingen / carrion flier with broad wings */
export function carrionFlierGeometry(): THREE.BufferGeometry {
  return memo('desert|flier', () => {
    const b = new Builder();
    b.add(geo.sphere(0.03, 6, 4), S.desertRockDeep, { s: [1.6, 0.8, 0.9] });
    b.add(geo.sphere(0.015, 5, 4), S.desertBoneShade, { p: [0.05, 0.005, 0] });
    for (const sz of [-1, 1]) b.add(geo.box(0.07, 0.006, 0.14), S.desertRockDeep, { p: [0, 0.004, sz * 0.08], r: [sz * 0.25, 0, 0] });
    return b.build();
  });
}

/** Staubteufel: gedrehter Staubtrichter / dust devil: twisted dust funnel */
export function dustDevilGeometry(): THREE.BufferGeometry {
  return memo('desert|devil', () => {
    const b = new Builder();
    for (let i = 0; i < 6; i++) {
      const y = i * 0.12, r = 0.05 + i * 0.035;
      b.add(geo.torus(r, 0.02 + i * 0.005, 3, 10), i % 2 ? S.desertDust : S.desertSandLight, { p: [Math.sin(i * 1.3) * 0.03, y + 0.04, Math.cos(i * 1.3) * 0.03], r: [Math.PI / 2 + Math.sin(i) * 0.15, 0, 0] });
    }
    return b.build();
  });
}

// ---------- Aussenposten der Verdan / Verdan outposts ----------

/**
 * Aussenposten der Vergessenen statt Stadt (Wuestenwelt): Sandsteinsockel, Kuppelbunker mit Metallband und Sehschlitz,
 * ab Stufe 2 ein Relaismast mit Schuessel, ab Stufe 3 ein zweiter Bunker und eine Mauer; rot-weisses Fluegelwappen.
 * Besetzt: Banner und Band in der Farbe der Fraktion; Hauptquartier: hoeherer Mast und grosses Banner. Fenster leuchten nachts.
 * Outpost of the Forgotten instead of a city (desert world): sandstone plinth, domed bunker with a metal band and a
 * vision slit, from level 2 a relay mast with a dish, from level 3 a second bunker and a wall; red and white winged
 * emblem. Occupied: banner and band in the faction colour; HQ: taller mast and a big banner. Windows glow at night.
 */
export function verdanOutpostGeometry(faction: FactionId | null, level: number, hq: boolean): THREE.BufferGeometry {
  const lv = Math.max(1, Math.min(3, level));
  return memo(`desert|outpost|${faction}|${lv}|${+hq}`, () => {
    const R = rng(8100 + lv * 7 + (hq ? 3 : 0));
    const b = new Builder();
    const stone = mix(S.verdanStone, S.desertSandLight, 0.35), dark = mix(S.verdanStoneDark, S.desertRockDark, 0.3);
    const own = faction ? factionTokens[faction].primary : null;
    const window = mat.window;
    // Sockel mit Stufen / plinth with steps
    b.add(geo.cbox(0.78, 0.06, 0.78, 0.14), dark, { p: [0, 0.03, 0] });
    b.add(geo.cbox(0.62, 0.05, 0.62, 0.1), stone, { p: [0, 0.085, 0] });
    /** Kuppelbunker / domed bunker */
    const dome = (x: number, z: number, r: number) => {
      b.add(geo.cyl(r, r * 1.05, 0.08, 10), stone, { p: [x, 0.15, z] });
      b.add(geo.cyl(r * 1.02, r * 1.02, 0.025, 10), own ?? S.verdanMetal, { p: [x, 0.2, z] });
      b.add(geo.hemi(r * 0.98, 12, 4), shade(stone, 1.05), { p: [x, 0.21, z], s: [1, 0.8, 1] });
      // Sehschlitz und Fenster / vision slit and windows
      b.add(geo.box(r * 1.1, 0.025, 0.02), S.ink, { p: [x, 0.25, z + r * 0.72] });
      for (const a of [-0.6, 0.6]) b.add(geo.box(0.04, 0.035, 0.012), window, { p: [x + Math.sin(a) * r * 0.98, 0.16, z + Math.cos(a) * r * 0.98], r: [0, a, 0] });
      // Wappen ueber dem Eingang / emblem above the entrance
      b.group({ p: [x, 0.3, z + r * 0.62], r: [-0.5, 0, 0] }, () => verdanEmblem(b, r * 3.4));
    };
    dome(lv >= 3 ? -0.08 : 0, lv >= 3 ? 0.06 : 0.02, hq ? 0.22 : 0.18);
    if (lv >= 2) {
      // Relaismast mit Schuessel / relay mast with a dish
      const mh = hq ? 0.75 : 0.55;
      b.add(geo.cyl(0.012, 0.02, mh, 5), S.verdanMetal, { p: [0.22, 0.11 + mh / 2, -0.2] });
      for (let i = 1; i < 4; i++) b.add(geo.box(0.06, 0.008, 0.008), S.verdanMetal, { p: [0.22, 0.11 + (mh * i) / 4, -0.2], r: [0, i * 0.8, 0] });
      b.add(geo.hemi(0.07, 8, 3), S.verdanWhite, { p: [0.22, 0.11 + mh * 0.75, -0.15], r: [-1.2, 0, 0] });
      b.add(geo.sphere(0.018, 6, 4), S.verdanRed, { p: [0.22, 0.13 + mh, -0.2] });
    }
    if (lv >= 3) {
      dome(0.22, 0.2, 0.12);
      // Mauer aus Sandsteinbloecken / wall of sandstone blocks
      for (let i = 0; i < 5; i++) b.add(geo.cbox(0.12, 0.08 + R() * 0.04, 0.06, 0.015), i % 2 ? stone : dark, { p: [-0.28 + i * 0.13, 0.15, -0.3], r: [0, (R() - 0.5) * 0.2, 0] });
    }
    // Banner der Besatzer (oder zerfetzter Verdan-Wimpel) / banner of the occupiers (or a tattered Verdan pennant)
    const pole = hq ? 0.62 : 0.42;
    b.add(geo.cyl(0.008, 0.01, pole, 5), S.verdanMetal, { p: [-0.27, 0.11 + pole / 2, 0.24] });
    if (own) b.add(geo.box(0.16, hq ? 0.12 : 0.09, 0.008), own, { p: [-0.19, 0.11 + pole - 0.07, 0.24] });
    else b.add(geo.box(0.1, 0.05, 0.008), S.verdanRed, { p: [-0.23, 0.11 + pole - 0.06, 0.24], r: [0, 0, -0.25] });
    // Sandwehen und Truemmer / sand drifts and rubble
    b.add(geo.sphere(1, 8, 4), S.desertSandLight, { p: [0.3, 0.06, 0.3], s: [0.16, 0.05, 0.1] });
    b.add(geo.dodeca(0.04), dark, { p: [-0.32, 0.07, -0.12], r: [R(), R(), R()] });
    return b.build();
  });
}
