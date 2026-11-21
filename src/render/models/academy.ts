/**
 * Schwebende Akademie der Velkar (ACADEMY) und Forschungsposten: Modelle in der Formensprache "Labor im Feld"
 * (velkarTech.ts). Die Akademie ist eine runde Campus-Plattform mit Laborkuppel, Observatoriumsturm und Triebwerksgondeln;
 * am Boden steht sie auf Landebeinen, in der Luft leuchten die Duesen. Mit der Stufe kommen Institutsbauten auf dem Rand
 * hinzu und der Turm waechst. Der Posten ist eine kleine Messstation mit Kuppel, Mast und Schuessel.
 * Velkar floating academy (ACADEMY) and research posts: models in the "lab in the field" design language (velkarTech.ts).
 * The academy is a round campus platform with a lab dome, an observatory tower and thruster pods; on the ground it rests
 * on landing legs, in the air its nozzles glow. With the level, institute buildings appear on the rim and the tower grows.
 * The post is a small survey station with a dome, a mast and a dish.
 * Ursprung unten mittig, Massstab wie die Stadt (ein Feld = 1) / origin bottom centre, scale like the city (one tile = 1).
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { semantic } from '../../design/tokens';
import { addEmblem } from './emblems';
import { Builder, col, geo, memo, shade } from './kit';
import { look, mat } from './look';
import { TECH, techDot } from './velkarTech';

const HALF_PI = Math.PI / 2;
/** Plattform: Radius, Dicke, Unterkante am Boden (Landebeine) / platform: radius, thickness, underside on the ground (landing legs) */
export const ACADEMY_MODEL = {
  radius: 0.42,
  deck: 0.07,
  /** Hoehe der Plattform-Unterkante am Boden (Beine) / height of the platform underside on the ground (legs) */
  legs: 0.14,
  /** Schwebehoehe ueber dem Feld (Unterkante): abhebend und schwebend / hover height above the tile (underside): lifting and floating */
  liftY: 0.2,
  airY: 0.55,
  /** Auf und Ab beim Schweben (Feldbreiten) und Periode in s / bob while floating (tile widths) and period in s */
  bob: 0.035,
  /** Massstab des Modells auf dem Brett (wie CITY_SCALE der Stadt) / scale of the model on the board (like the city's CITY_SCALE) */
  scale: 1.12,
  bobPeriod: 2.6,
};

/** Hoehe des Turms je Stufe (ueber dem Deck) / tower height per level (above the deck) */
const towerH = (lv: number) => 0.22 + 0.035 * Math.min(8, lv);

/**
 * Akademie-Geometrie. air = schwebend (keine Beine, leuchtende Duesen); Ursprung = Plattform-Unterkante bei air, sonst
 * der Boden. Fraktion fuer Akzente (in der Regel Velkar; nach dem Verlust zeigt das Brett eine Stadt).
 * Academy geometry. air = floating (no legs, glowing nozzles); origin = platform underside when air, otherwise the ground.
 * Faction for accents (normally Velkar; after the loss the board shows a city).
 */
export function academyGeometry(f: FactionId | null, level: number, air: boolean): THREE.BufferGeometry {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  return memo(`academy|${f ?? 'neutral'}|${lv}|${air ? 'air' : 'ground'}`, () => academy(f, lv, air).build());
}

/**
 * Leuchtfeuer an der Antennenspitze des Turms relativ zur Feldmitte (Massstab und Schwebehoehe eingerechnet).
 * Beacon at the tower's antenna tip relative to the tile centre (scale and hover height included).
 */
export function academyBeacon(level: number, hover: number, air: boolean): [number, number, number] {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const k = ACADEMY_MODEL.scale;
  const top = (air ? 0 : ACADEMY_MODEL.legs) + ACADEMY_MODEL.deck;
  return [-0.21 * k, hover + (top + towerH(lv) + 0.205) * k, 0.11 * k];
}

export function academy(f: FactionId | null, lv: number, air: boolean): Builder {
  const b = new Builder();
  const L = look(f);
  const M = ACADEMY_MODEL;
  const base = air ? 0 : M.legs;
  const top = base + M.deck;
  // Landebeine mit Fuessen (nur am Boden) / landing legs with feet (ground only)
  if (!air) {
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
      b.tube([x * 0.75, base, z * 0.75], [x, 0.02, z], 0.018, 6, TECH.gearDark);
      b.cyl(0.04, 0.045, 0.02, 8, mat.dark, [x, 0.01, z]);
    }
  }
  // Plattform: Unterschale (Triebwerksseite), Deck, Rand in Fraktionsfarbe / platform: underside shell, deck, rim in faction colour
  b.add(geo.lathe([[0.0, -0.05], [0.22, -0.045], [M.radius - 0.03, -0.01], [M.radius, 0.0]], 16), TECH.gear, { p: [0, base, 0] });
  b.cyl(M.radius, M.radius, M.deck, 16, TECH.shell, [0, base + M.deck / 2, 0]);
  b.cyl(M.radius + 0.012, M.radius + 0.012, 0.022, 16, L.primary, [0, base + M.deck - 0.015, 0]);
  // Leuchtband am Rand / light band around the rim
  b.add(geo.torus(M.radius + 0.004, 0.008, 3, 20), TECH.glow, { p: [0, base + 0.02, 0], r: [HALF_PI, 0, 0] });
  // Triebwerksgondeln unter dem Rand, Duesen leuchten in der Luft / thruster pods below the rim, nozzles glow in the air
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.29, z = Math.sin(a) * 0.29;
    b.cyl(0.055, 0.05, 0.08, 10, TECH.gearDark, [x, base - 0.03, z]);
    b.cyl(0.04, 0.03, 0.03, 10, air ? TECH.glow : mat.dark, [x, base - 0.08, z]);
    if (air) b.add(geo.cone(0.03, 0.12, 8), TECH.arc, { p: [x, base - 0.15, z], r: [Math.PI, 0, 0] });
  }
  // Zentrale Laborkuppel auf einem Ring / central lab dome on a ring
  b.cyl(0.17, 0.18, 0.05, 14, TECH.gear, [0.03, top + 0.025, -0.03]);
  b.add(geo.hemi(0.16, 14, 5), mix2(TECH.shell, mat.glass), { p: [0.03, top + 0.05, -0.03] });
  b.box(0.2, 0.012, 0.012, TECH.glow, [0.03, top + 0.11, 0.12]);
  // Observatoriumsturm mit Kuppel und Antenne, waechst mit der Stufe / observatory tower with dome and antenna, grows with the level
  const th = towerH(lv);
  b.add(geo.ctaper(0.1, 0.1, 0.075, 0.075, th, 0.015), TECH.shell, { p: [-0.18, top + th / 2, 0.14] });
  for (let k = 1; k < 4; k++) b.box(0.102, 0.01, 0.102, TECH.gearDark, [-0.18, top + (th * k) / 4, 0.14]);
  b.add(geo.hemi(0.055, 10, 4), TECH.gear, { p: [-0.18, top + th, 0.14] });
  b.box(0.05, 0.012, 0.03, mat.dark, [-0.16, top + th + 0.035, 0.14], [0, 0, -0.5]);
  b.tube([-0.2, top + th + 0.04, 0.12], [-0.21, top + th + 0.2, 0.11], 0.005, 4, mat.dark);
  techDot(b, [-0.21, top + th + 0.205, 0.11], 0.012);
  // Emblem der Fraktion am Turm / faction emblem on the tower
  if (f) addEmblem(b, f, 0.06, 0.01, L.primary, { p: [-0.18, top + th * 0.6, 0.18 + 0.002] });
  // Institutsbauten auf dem Rand, je Stufe einer mehr (bis 6) / institute buildings on the rim, one more per level (up to 6)
  const n = Math.min(6, lv - 1);
  for (let i = 0; i < n; i++) {
    const a = -HALF_PI + 0.35 + i * 0.95;
    const x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
    const h = 0.07 + 0.012 * ((i * 5) % 4);
    b.add(geo.cbox(0.1, h, 0.08, 0.012), i % 2 ? TECH.shell : TECH.shellShade, { p: [x, top + h / 2, z], r: [0, -a, 0] });
    b.box(0.06, 0.012, 0.004, TECH.glow, [x + Math.cos(a) * 0.041, top + h * 0.6, z + Math.sin(a) * 0.041], [0, -a + HALF_PI, 0]);
    b.box(0.08, 0.01, 0.06, L.roof, [x, top + h + 0.005, z], [0, -a, 0]);
  }
  // Fahne der Hauptstadt / flag of the capital
  b.tube([0.3, top, 0.2], [0.3, top + 0.32, 0.2], 0.006, 4, mat.dark);
  b.box(0.12, 0.07, 0.006, L.primary, [0.36, top + 0.28, 0.2]);
  return b;
}

/** Mischfarbe fuer die Kuppel / mixed colour for the dome */
function mix2(a: THREE.Color, c: THREE.Color): THREE.Color {
  return a.clone().lerp(c, 0.5);
}

/**
 * Schutzschild als Kugel (nur Form, Farbe ueber das Material); r = Radius in Feldbreiten.
 * Shield as a sphere (shape only, colour via the material); r = radius in tile widths.
 */
export function shieldGeometry(): THREE.BufferGeometry {
  return memo('academy|shield', () => {
    const g = new THREE.IcosahedronGeometry(0.62, 2);
    // Kanten des Wabenmusters: flache Normalen fuer einen facettierten Comic-Look / honeycomb edges: flat normals for a faceted comic look
    return g.toNonIndexed();
  });
}

/** Farbe des Schilds (Token) / colour of the shield (token) */
export const shieldColor = () => col(semantic.velkarTechGlow);
/** Farbe des Bodenschattens (Token) / colour of the ground shadow (token) */
export const hoverShadowColor = () => shade(semantic.ink, 1);

/**
 * Forschungsposten: kleine Messstation auf einem Sockel mit Kuppel, Mast und Schuessel, Leuchten und Fahne.
 * Research post: small survey station on a plinth with a dome, a mast and a dish, lights and a flag.
 */
export function researchPostGeometry(f: FactionId | null, relay = false): THREE.BufferGeometry {
  return memo(`academy|post|${f ?? 'neutral'}|${relay ? 'relay' : ''}`, () => researchPost(f, relay).build());
}

/**
 * Beamer-Relay: runde Teleporterplatte mit Emitterring auf zwei Pylonen und leuchtendem Kern, vorn links auf dem Posten.
 * Beam relay: round teleporter pad with an emitter ring on two pylons and a glowing core, front left on the post.
 */
function beamerPad(b: Builder, f: FactionId | null, x: number, z: number) {
  const L = look(f);
  b.cyl(0.13, 0.14, 0.03, 14, TECH.gearDark, [x, 0.065, z]);
  b.cyl(0.1, 0.1, 0.012, 14, TECH.glow, [x, 0.085, z]);
  b.cyl(0.135, 0.135, 0.012, 14, L.primary, [x, 0.052, z]);
  for (const s of [-1, 1]) {
    b.add(geo.ctaper(0.035, 0.035, 0.022, 0.022, 0.26, 0.006), TECH.shell, { p: [x + s * 0.12, 0.2, z] });
    techDot(b, [x + s * 0.12, 0.34, z], 0.012);
  }
  // Emitterring ueber der Platte / emitter ring above the pad
  b.add(geo.torus(0.12, 0.012, 4, 18), TECH.arc, { p: [x, 0.3, z], r: [HALF_PI, 0, 0] });
}

export function researchPost(f: FactionId | null, relay = false): Builder {
  const b = new Builder();
  const L = look(f);
  // Sockel mit Bordstein in Fraktionsfarbe / plinth with a kerb in the faction colour
  b.add(geo.cbox(0.7, 0.05, 0.7, 0.06), mat.concrete, { p: [0, 0.025, 0] });
  b.add(geo.cbox(0.72, 0.02, 0.72, 0.06), L.primary, { p: [0, 0.01, 0] });
  // Laborkuppel / lab dome
  b.cyl(0.17, 0.18, 0.05, 12, TECH.gear, [-0.06, 0.075, -0.06]);
  b.add(geo.hemi(0.16, 12, 4), TECH.shell, { p: [-0.06, 0.1, -0.06] });
  b.box(0.14, 0.012, 0.012, TECH.glow, [-0.06, 0.15, 0.1]);
  // Containerlabor / container lab
  b.add(geo.cbox(0.22, 0.12, 0.12, 0.015), TECH.shellShade, { p: [0.16, 0.11, -0.12] });
  b.box(0.16, 0.014, 0.004, TECH.glow, [0.16, 0.13, -0.059]);
  // Mast mit Schuessel und Leuchtspitze / mast with dish and glowing tip
  b.tube([0.18, 0.05, 0.16], [0.18, 0.5, 0.16], 0.01, 5, TECH.gearDark);
  for (const y of [0.2, 0.35]) b.box(0.05, 0.008, 0.008, TECH.gearDark, [0.18, y, 0.16]);
  b.add(geo.lathe([[0, 0], [0.07, 0.025], [0.09, 0.05]], 10), TECH.shell, { p: [0.18, 0.4, 0.16], r: [-0.9, 0.6, 0] });
  techDot(b, [0.18, 0.51, 0.16], 0.014);
  // Emblem und kleine Fahne / emblem and small flag
  if (f) addEmblem(b, f, 0.05, 0.008, L.primary, { p: [0.16, 0.12, 0.002 - 0.059], r: [0, 0, 0] });
  b.tube([-0.27, 0.05, 0.22], [-0.27, 0.34, 0.22], 0.005, 4, mat.dark);
  b.box(0.1, 0.06, 0.005, L.primary, [-0.22, 0.3, 0.22]);
  if (relay) beamerPad(b, f, -0.12, 0.17);
  return b;
}
