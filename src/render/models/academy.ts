/**
 * Schwebende Akademie der Velkar (ACADEMY) und Forschungsposten: Modelle in der Formensprache "Labor im Feld"
 * (velkarTech.ts). Die Akademie ist ein schwebender Hightech-Campus: gestufte Haupthalle mit Fensterbaendern und
 * Observatoriumskuppel (Teleskopschlitz, Teleskop), Laborturm mit drehender Radarantenne (eigenes Teil), Tesla-Spule mit
 * leuchtenden Ringen (Leuchtfeuer an der Spitze), Solarfluegel, Stege und Gelaender, Rumpfschale mit Rippen und
 * Terraform-Projektor, vier Triebwerksgondeln am Rand. Haltungen: am Boden auf weit ausgefahrenen Landebeinen,
 * abhebend mit halb eingefahrenen Beinen und langen Flammen, schwebend mit eingeklappten Beinen, terraformend mit
 * ausgeklappten Emitterarmen. Mit der Stufe kommen Institutsbauten auf dem Rand hinzu und der Turm waechst. Der Posten ist
 * eine kleine Messstation mit Kuppel, Mast und Schuessel.
 * Velkar floating academy (ACADEMY) and research posts: models in the "lab in the field" design language (velkarTech.ts).
 * The academy is a floating high-tech campus: tiered main hall with window bands and an observatory dome (telescope slit,
 * telescope), lab tower with a rotating radar array (own part), tesla spire with glowing rings (beacon at the tip), solar
 * wings, walkways and railing, hull shell with ribs and the terraform projector, four thruster pods on the rim. Poses:
 * on the ground on far extended landing legs, lifting with half retracted legs and long flames, floating with folded legs,
 * terraforming with deployed emitter arms. With the level, institute buildings appear on the rim and the tower grows. The
 * post is a small survey station with a dome, a mast and a dish.
 * Ursprung unten mittig, Massstab wie die Stadt (ein Feld = 1) / origin bottom centre, scale like the city (one tile = 1).
 */
import * as THREE from 'three';
import type { AcademyModule, FactionId } from '../../data/balance';
import { semantic } from '../../design/tokens';
import { addEmblem } from './emblems';
import { Builder, col, geo, memo, shade, type V3 } from './kit';
import { look, mat } from './look';
import { TECH, techDot } from './velkarTech';

const HALF_PI = Math.PI / 2;
/** Plattform: Radius, Dicke, Unterkante am Boden (Landebeine) / platform: radius, thickness, underside on the ground (landing legs) */
export const ACADEMY_MODEL = {
  radius: 0.42,
  deck: 0.06,
  /**
   * Hoehe der Plattform-Unterkante am Boden (ausgefahrene Landebeine; die Rumpfschale haengt bis hull darunter, so bleibt
   * eine sichtbare Luecke zum Boden) / height of the platform underside on the ground (extended landing legs; the hull shell
   * hangs down by hull below it, leaving a visible gap to the ground)
   */
  legs: 0.21,
  /** Tiefe der Rumpfschale unter dem Deck / depth of the hull shell below the deck */
  hull: 0.085,
  /** Schwebehoehe ueber dem Feld (Unterkante): abhebend und schwebend / hover height above the tile (underside): lifting and floating */
  liftY: 0.24,
  airY: 0.58,
  /** Terraformen: etwas tiefer, damit die Strahlen kurz und lesbar bleiben / terraforming: a little lower so the beams stay short and readable */
  terraformY: 0.46,
  /** Auf und Ab beim Schweben (Feldbreiten) und Periode in s / bob while floating (tile widths) and period in s */
  bob: 0.035,
  /** Massstab des Modells auf dem Brett (wie CITY_SCALE der Stadt) / scale of the model on the board (like the city's CITY_SCALE) */
  scale: 1.12,
  bobPeriod: 2.6,
};

/**
 * Haltung der Akademie: ground = gelandet (Beine ausgefahren), lift = hebt ab (Beine halb eingefahren, Duesen an),
 * air = schwebt (Beine eingefahren), terraform = schwebt mit ausgefahrenem Terraform-Projektor unter dem Rumpf.
 * Pose of the academy: ground = landed (legs extended), lift = lifting off (legs half retracted, nozzles on), air =
 * floating (legs retracted), terraform = floating with the terraform projector deployed below the hull.
 */
export type AcademyPose = 'ground' | 'lift' | 'air' | 'terraform';
/** Haltung aus dem Zustand der Stadt / pose from the city state */
export function academyPose(air: { phase: 'lifting' | 'flying' | 'terraform' } | undefined): AcademyPose {
  return !air ? 'ground' : air.phase === 'lifting' ? 'lift' : air.phase === 'terraform' ? 'terraform' : 'air';
}
/** Schwebehoehe je Haltung / hover height per pose */
export const poseY = (p: AcademyPose) => (p === 'ground' ? 0 : p === 'lift' ? ACADEMY_MODEL.liftY : p === 'terraform' ? ACADEMY_MODEL.terraformY : ACADEMY_MODEL.airY);
const asPose = (p: boolean | AcademyPose): AcademyPose => (p === true ? 'air' : p === false ? 'ground' : p);
/** Plattform-Unterkante im Modell (am Boden auf den Beinen) / platform underside in the model (on the legs when grounded) */
const baseOf = (p: AcademyPose) => (p === 'ground' ? ACADEMY_MODEL.legs : 0);

/** Hoehe des Laborturms je Stufe (ueber dem Deck) / lab tower height per level (above the deck) */
const towerH = (lv: number) => 0.2 + 0.03 * Math.min(8, lv);
/** Lage des Laborturms und der Tesla-Spitze auf dem Deck / position of the lab tower and the tesla spire on the deck */
const TOWER: [number, number] = [-0.2, 0.13];
const SPIRE: [number, number] = [0.21, -0.15];
const SPIRE_H = 0.3;

/**
 * Akademie-Geometrie. pose (oder true = schwebend, false = am Boden); Ursprung = Plattform-Unterkante in der Luft, sonst
 * der Boden. low = niedrige Qualitaet (ohne Gelaender, Rippen und Kleinteile). Fraktion fuer Akzente.
 * Academy geometry. pose (or true = floating, false = on the ground); origin = platform underside in the air, otherwise the
 * ground. low = low quality (no railings, ribs and small parts). Faction for accents.
 */
export function academyGeometry(f: FactionId | null, level: number, pose: boolean | AcademyPose, low = false, mods: AcademyMods = {}): THREE.BufferGeometry {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  const p = asPose(pose);
  const m = modsKey(mods);
  return memo(`academy|${f ?? 'neutral'}|${lv}|${p}|${low ? 'low' : 'high'}|${m}`, () => academy(f, lv, p, low, mods).build());
}

/** Gekaufte Modulstufen (ACADEMY.modules) fuer das Modell / bought module levels (ACADEMY.modules) for the model */
export type AcademyMods = Partial<Record<AcademyModule, number>>;
const MOD_ORDER: AcademyModule[] = ['shield', 'missiles', 'armour', 'beam'];
const modsKey = (m: AcademyMods) => MOD_ORDER.map((k) => Math.max(0, Math.min(3, Math.floor(m[k] ?? 0)))).join('');

/**
 * Austrittspunkt des Neutronenstrahls (Linse an der Spitze der Tesla-Spule) relativ zur Feldmitte, wie academyBeacon.
 * Exit point of the neutron beam (lens at the tip of the tesla spire) relative to the tile centre, like academyBeacon.
 */
export function academyEmitter(level: number, hover: number, pose: boolean | AcademyPose): [number, number, number] {
  const k = ACADEMY_MODEL.scale;
  const top = baseOf(asPose(pose)) + ACADEMY_MODEL.deck;
  void level;
  return [SPIRE[0] * k, hover + (top + SPIRE_H + EMITTER_Y) * k, SPIRE[1] * k];
}
/** Hoehe der Strahllinse ueber der Spulenspitze / height of the beam lens above the spire tip */
const EMITTER_Y = 0.075;
/** Schlichter Quader (12 Dreiecke, fuer das Budget der Module) / plain box (12 triangles, for the modules' budget) */
const pbox = (b: Builder, w: number, h: number, d: number, c: THREE.Color, p: V3, r?: V3) => b.add(geo.box(w, h, d), c, { p, ...(r ? { r } : {}) });

/**
 * Sichtbare Module (ACADEMY.modules), in schlichten Quadern, damit die volle Festung im Dreiecksbudget bleibt:
 * Neutronenstrahl = Linse und Kragen an der Spulenspitze (immer, eingebaut), je Ausbaustufe ein Spulenband;
 * Abwehrraketen = je Stufe ein Werferkasten am Deckrand mit leuchtenden Kappen; Panzerung = je Stufe zwei (niedrig: eine)
 * Platten am Rumpfrand; Schildverstaerkung = je Stufe ein Generatormast auf dem inneren Deck.
 * Visible modules (ACADEMY.modules), in plain boxes so the full fortress stays within the triangle budget: neutron beam =
 * lens and collar at the spire tip (always, built in), one coil band per upgrade level; defence missiles = one launcher box
 * on the deck rim per level with glowing caps; armour = two (low: one) plates on the hull rim per level; shield
 * reinforcement = one generator mast on the inner deck per level.
 */
function academyModules(b: Builder, base: number, top: number, low: boolean, mods: AcademyMods, primary: THREE.Color) {
  const lvl = (k: AcademyModule) => Math.max(0, Math.min(3, Math.floor(mods[k] ?? 0)));
  const [sx0, sz0] = SPIRE;
  // Neutronenstrahl: Kragen und Linse ueber der Kugel / neutron beam: collar and lens above the sphere
  pbox(b, 0.05, 0.012, 0.05, TECH.gearDark, [sx0, top + SPIRE_H + 0.042, sz0], [0, 0.6, 0]);
  b.add(geo.cone(0.02, 0.04, low ? 5 : 6), TECH.arc, { p: [sx0, top + SPIRE_H + EMITTER_Y - 0.012, sz0] });
  if (!low) for (let i = 0; i < lvl('beam'); i++) b.cyl(0.03, 0.03, 0.012, 6, TECH.coil, [sx0, top + SPIRE_H * 0.35 + i * 0.045, sz0]);
  // Abwehrraketen: Werferkasten nach aussen geneigt, Kappen leuchten / defence missiles: launcher box tilted outwards, caps glow
  const pods = [1.75, 4.55, 5.1];
  for (let i = 0; i < lvl('missiles'); i++) {
    const a = pods[i];
    const x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.27;
    pbox(b, 0.075, 0.04, 0.055, TECH.gearDark, [x, top + 0.04, z], [0, -a, 0.45]);
    if (!low) pbox(b, 0.012, 0.03, 0.045, TECH.arc, [x + Math.cos(a) * 0.035, top + 0.058, z + Math.sin(a) * 0.035], [0, -a, 0.45]);
  }
  // Panzerung: Platten am Rumpfrand (unter dem Deck) / armour: plates on the hull rim (below the deck)
  const plates = [[0.4, 3.54], [1.97, 5.1], [1.2, 4.3]];
  for (let i = 0; i < lvl('armour'); i++) {
    for (const a of plates[i].slice(0, low ? 1 : 2)) pbox(b, 0.17, 0.05, 0.022, i % 2 ? TECH.shellShade : primary, [Math.cos(a) * 0.4, base - 0.022, Math.sin(a) * 0.4], [0, -a + HALF_PI, 0.35]);
  }
  // Schildverstaerkung: Generatormast mit Leuchtkopf / shield reinforcement: generator mast with a glowing head
  const masts = [3.6, 0.15];
  for (let i = 0; i < lvl('shield'); i++) {
    const a = masts[i];
    const x = Math.cos(a) * 0.24, z = Math.sin(a) * 0.24;
    pbox(b, 0.022, 0.12, 0.022, TECH.gear, [x, top + 0.07, z]);
    pbox(b, 0.036, 0.022, 0.036, TECH.glow, [x, top + 0.14, z], [0, 0.785, 0]);
  }
}

/**
 * Leuchtfeuer an der Spitze der Tesla-Spule relativ zur Feldmitte (Massstab und Schwebehoehe eingerechnet; das Brett
 * fuehrt es beim Auf und Ab mit).
 * Beacon at the tip of the tesla spire relative to the tile centre (scale and hover height included; the board moves it
 * along with the bob).
 */
export function academyBeacon(level: number, hover: number, pose: boolean | AcademyPose): [number, number, number] {
  const k = ACADEMY_MODEL.scale;
  const top = baseOf(asPose(pose)) + ACADEMY_MODEL.deck;
  void level;
  return [SPIRE[0] * k, hover + (top + SPIRE_H + 0.05) * k, SPIRE[1] * k];
}

/**
 * Drehpunkt der Radarantenne auf dem Laborturm im Modell (vor dem Massstab) / pivot of the radar array on the lab tower in
 * the model (before scaling).
 */
export function academyRadarAt(level: number, pose: boolean | AcademyPose): [number, number, number] {
  const lv = Math.max(1, Math.min(8, Math.floor(level)));
  return [TOWER[0], baseOf(asPose(pose)) + ACADEMY_MODEL.deck + towerH(lv) + 0.075, TOWER[1]];
}

/** Drehende Radar- und Antennengruppe (eigenes Teil, das Brett dreht es) / rotating radar and antenna array (own part, the board spins it) */
export function academyRadarGeometry(): THREE.BufferGeometry {
  return memo('academy|radar', () => {
    const b = new Builder();
    b.cyl(0.018, 0.022, 0.02, 8, TECH.gearDark, [0, 0.01, 0]);
    // Schuessel auf einem Ausleger, Gegengewicht, Stabantennen / dish on a boom, counterweight, rod antennas
    b.box(0.13, 0.012, 0.016, TECH.gear, [0.01, 0.025, 0]);
    b.add(geo.lathe([[0, 0], [0.035, 0.012], [0.06, 0.03]], 12), TECH.shell, { p: [0.07, 0.04, 0], r: [0, 0, -1.25] });
    b.add(geo.cone(0.008, 0.04, 5), TECH.gearDark, { p: [0.09, 0.05, 0], r: [0, 0, -1.25 + Math.PI / 2] });
    b.box(0.03, 0.03, 0.03, TECH.gearDark, [-0.055, 0.03, 0]);
    for (const z of [-0.012, 0.012]) b.tube([-0.04, 0.03, z], [-0.04, 0.11, z], 0.003, 4, mat.dark);
    techDot(b, [-0.04, 0.115, 0.012], 0.007);
    return b.build();
  });
}

export function academy(f: FactionId | null, lv: number, pose: AcademyPose, low = false, mods: AcademyMods = {}): Builder {
  const b = new Builder();
  const L = look(f);
  const M = ACADEMY_MODEL;
  const base = baseOf(pose);
  const top = base + M.deck;
  const flying = pose !== 'ground';
  const R = M.radius;
  // niedrige Qualitaet: weniger Rundungssegmente / low quality: fewer round segments
  const S = (n: number) => (low ? Math.max(6, Math.round(n * 0.6)) : n);
  // ---------- Landebeine: am Boden ausgefahren und gut sichtbar, abhebend halb, schwebend eingeklappt ----------
  // landing legs: extended and clearly visible on the ground, half way when lifting, folded when floating
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const at = (r: number, y: number): V3 => [ca * r, y, sa * r];
    const hip = at(0.2, base - 0.05);
    if (pose === 'ground') {
      // Oberschenkel nach aussen, Knie, Unterschenkel zum Fuss, Hydraulik / upper strut outwards, knee, lower strut to the foot, hydraulics
      const knee = at(0.35, base - 0.035), foot = at(0.37, 0.03);
      b.tube(hip, knee, 0.024, 8, TECH.gearDark, 0.02);
      b.tube(knee, foot, 0.02, 8, TECH.gear, 0.017);
      b.tube(at(0.24, base - 0.075), at(0.355, 0.08), 0.009, 6, mat.metalLight);
      b.add(geo.sphere(0.026, 6, 4), L.primary, { p: knee });
      b.cyl(0.05, 0.06, 0.03, S(12), TECH.gearDark, at(0.37, 0.015));
      b.cyl(0.055, 0.055, 0.008, S(12), L.primary, at(0.37, 0.034));
    } else if (pose === 'lift') {
      const knee = at(0.31, base - 0.06), foot = at(0.3, base - 0.12);
      b.tube(hip, knee, 0.022, 8, TECH.gearDark, 0.018);
      b.tube(knee, foot, 0.018, 8, TECH.gear);
      b.add(geo.sphere(0.022, 6, 4), L.primary, { p: knee });
      b.cyl(0.04, 0.045, 0.02, S(10), TECH.gearDark, foot);
    } else {
      // eingeklappt in einer Mulde unter dem Rand / folded into a recess below the rim
      b.tube(hip, at(0.3, base - 0.03), 0.018, 6, TECH.gearDark);
      b.cyl(0.036, 0.04, 0.016, S(10), TECH.gearDark, at(0.3, base - 0.035));
    }
  }
  // ---------- Rumpf: Unterschale mit Maschinen, Deck, Rand in Fraktionsfarbe ----------
  // hull: underside shell with machinery, deck, rim in the faction colour
  b.add(geo.lathe([[0.0, -M.hull], [0.13, -M.hull + 0.004], [0.27, -0.05], [R - 0.03, -0.012], [R, 0.0]], S(20)), TECH.gear, { p: [0, base, 0] });
  b.cyl(R, R, M.deck, S(20), TECH.shell, [0, base + M.deck / 2, 0]);
  b.cyl(R + 0.012, R + 0.012, 0.022, S(20), L.primary, [0, base + M.deck - 0.014, 0]);
  b.add(geo.torus(R + 0.004, 0.008, 3, S(28)), TECH.glow, { p: [0, base + 0.016, 0], r: [HALF_PI, 0, 0] });
  // inneres Deck eine Stufe hoeher, mit Laufring / inner deck one step higher, with a walking ring
  b.cyl(0.3, 0.3, 0.016, S(20), TECH.shellShade, [0, top + 0.008, 0]);
  b.add(geo.torus(0.3, 0.006, 3, S(28)), TECH.gearDark, { p: [0, top + 0.016, 0], r: [HALF_PI, 0, 0] });
  if (!low) {
    // Rippen und Leitungen unter dem Rumpf / ribs and conduits under the hull
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      b.box(0.15, 0.022, 0.018, TECH.gearDark, [Math.cos(a) * 0.22, base - 0.045, Math.sin(a) * 0.22], [0, -a, -0.28]);
    }
    for (const a of [0.3, 2.2, 4.1]) b.cyl(0.035, 0.035, 0.05, 8, TECH.shellShade, [Math.cos(a) * 0.12, base - M.hull + 0.005, Math.sin(a) * 0.12], [HALF_PI, a, 0]);
  }
  // Terraform-Projektor in der Mitte der Unterseite: Linse, im Terraformen mit drei ausgeklappten Emitterarmen
  // terraform projector in the middle of the underside: lens, while terraforming with three deployed emitter arms
  b.cyl(0.07, 0.05, 0.03, S(14), TECH.gearDark, [0, base - M.hull - 0.012, 0]);
  b.cyl(0.042, 0.042, 0.012, S(14), pose === 'terraform' ? TECH.arc : flying ? TECH.glow : mat.glassDark, [0, base - M.hull - 0.03, 0]);
  if (pose === 'terraform') {
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + 0.4;
      const tip: V3 = [Math.cos(a) * 0.17, base - M.hull - 0.07, Math.sin(a) * 0.17];
      b.tube([Math.cos(a) * 0.06, base - M.hull - 0.01, Math.sin(a) * 0.06], tip, 0.012, 6, TECH.gear);
      b.add(geo.cone(0.03, 0.04, S(10)), TECH.gearDark, { p: [tip[0], tip[1] - 0.005, tip[2]], r: [Math.PI, 0, 0] });
      b.add(geo.sphere(0.018, 8, 6), TECH.arc, { p: [tip[0], tip[1] - 0.03, tip[2]] });
    }
    b.add(geo.torus(0.1, 0.008, 3, S(20)), TECH.arc, { p: [0, base - M.hull - 0.045, 0], r: [HALF_PI, 0, 0] });
  }
  // ---------- Triebwerksgondeln am Rand (ragen ueber das Deck), Duesen leuchten in der Luft ----------
  // thruster pods on the rim (rising above the deck), nozzles glow in the air
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const x = Math.cos(a) * 0.37, z = Math.sin(a) * 0.37;
    b.cyl(0.058, 0.062, 0.15, S(12), TECH.shellShade, [x, base + 0.005, z]);
    b.cyl(0.064, 0.064, 0.018, S(12), L.primary, [x, top + 0.02, z]);
    b.add(geo.hemi(0.05, S(12), 3), TECH.gear, { p: [x, top + 0.029, z] });
    b.cyl(0.05, 0.036, 0.035, S(12), TECH.gearDark, [x, base - 0.09, z]);
    b.cyl(0.034, 0.034, 0.008, S(12), flying ? TECH.glow : mat.dark, [x, base - 0.11, z]);
    if (flying) {
      b.add(geo.cone(0.032, pose === 'lift' ? 0.17 : 0.12, S(10)), TECH.arc, { p: [x, base - 0.11 - (pose === 'lift' ? 0.085 : 0.06), z], r: [Math.PI, 0, 0] });
    }
  }
  // ---------- Solarfluegel links und rechts am Rand / solar wings left and right on the rim ----------
  for (const sx of [-1, 1]) {
    b.group({ p: [sx * 0.43, base + 0.03, 0], r: [0, 0, sx * -0.35] }, () => {
      b.box(0.075, 0.012, 0.24, TECH.gearDark, [0, 0, 0]);
      for (const z of [-0.08, 0, 0.08]) b.box(0.062, 0.014, 0.07, mat.glassDark, [0, 0.003, z]);
      b.box(0.08, 0.006, 0.01, TECH.glow, [0, 0.008, 0.118]);
    });
  }
  // ---------- Hauptgebaeude: Stufenbau mit Fensterbaendern, Observatoriumskuppel mit Teleskopschlitz ----------
  // main hall: tiered building with window bands, observatory dome with a telescope slit
  const hx = 0.04, hz = -0.04;
  b.add(geo.ctaper(0.36, 0.32, 0.34, 0.3, 0.1, 0.04), TECH.shellShade, { p: [hx, top + 0.05, hz] });
  b.add(geo.ctaper(0.365, 0.325, 0.365, 0.325, 0.02, 0.04), mat.window, { p: [hx, top + 0.055, hz] });
  b.add(geo.ctaper(0.29, 0.25, 0.32, 0.28, 0.012, 0.03), L.primary, { p: [hx, top + 0.104, hz] });
  b.add(geo.ctaper(0.27, 0.24, 0.25, 0.22, 0.08, 0.03), TECH.shell, { p: [hx, top + 0.15, hz] });
  b.add(geo.ctaper(0.272, 0.242, 0.272, 0.242, 0.016, 0.03), mat.window, { p: [hx, top + 0.15, hz] });
  // Kuppel auf Ring, Schlitz und Teleskop / dome on a ring, slit and telescope
  const dy = top + 0.19;
  b.cyl(0.115, 0.12, 0.02, S(20), TECH.gear, [hx, dy + 0.01, hz]);
  b.add(geo.hemi(0.115, S(20), 6), mix2(TECH.shell, mat.glass), { p: [hx, dy + 0.02, hz] });
  b.group({ p: [hx, dy + 0.02, hz], r: [0, 0.6, 0] }, () => {
    b.add(geo.cbox(0.03, 0.115, 0.012, 0.004), mat.dark, { p: [0, 0.07, 0.086], r: [-0.65, 0, 0] });
    b.box(0.026, 0.01, 0.2, TECH.gearDark, [0, 0.112, 0.0], [0, 0, 0]);
    b.tube([0, 0.06, 0.0], [0, 0.135, 0.12], 0.014, S(10), TECH.gearDark, 0.018);
    b.cyl(0.019, 0.019, 0.01, S(10), TECH.glow, [0, 0.137, 0.123], [-0.95, 0, 0]);
  });
  // Laborkuppel klein daneben / small lab dome next to it
  b.cyl(0.07, 0.075, 0.03, S(14), TECH.gear, [0.2, top + 0.015, 0.12]);
  b.add(geo.hemi(0.065, S(14), 4), TECH.shell, { p: [0.2, top + 0.03, 0.12] });
  b.box(0.07, 0.01, 0.01, TECH.glow, [0.2, top + 0.05, 0.188]);
  // ---------- Laborturm mit Fenstern, Plattform fuer die drehende Antenne (eigenes Teil) ----------
  // lab tower with windows, platform for the rotating antenna (own part)
  const th = towerH(lv);
  const [tx, tz] = TOWER;
  b.add(geo.ctaper(0.1, 0.1, 0.075, 0.075, th, 0.016), TECH.shell, { p: [tx, top + th / 2, tz] });
  for (let k = 1; k < 4; k++) b.add(geo.ctaper(0.104, 0.104, 0.104, 0.104, 0.012, 0.016), k === 2 ? mat.window : TECH.gearDark, { p: [tx, top + (th * k) / 4, tz] });
  b.cyl(0.06, 0.05, 0.03, S(12), TECH.gear, [tx, top + th + 0.015, tz]);
  b.cyl(0.012, 0.012, 0.045, 6, TECH.gearDark, [tx, top + th + 0.05, tz]);
  if (f) addEmblem(b, f, 0.055, 0.01, L.primary, { p: [tx, top + th * 0.62, tz + 0.04 + 0.002] });
  // ---------- Tesla-Spule mit leuchtenden Ringen und Kugel (Leuchtfeuer an der Spitze) ----------
  // tesla spire with glowing rings and a sphere (beacon at the tip)
  const [sx0, sz0] = SPIRE;
  b.cyl(0.05, 0.06, 0.03, S(12), TECH.gearDark, [sx0, top + 0.015, sz0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    b.tube([sx0 + Math.sin(a) * 0.05, top + 0.02, sz0 + Math.cos(a) * 0.05], [sx0, top + SPIRE_H * 0.8, sz0], 0.006, 4, TECH.gear);
  }
  b.cyl(0.014, 0.02, SPIRE_H, 8, TECH.gearDark, [sx0, top + SPIRE_H / 2, sz0]);
  for (let i = 0; i < 4; i++) b.add(geo.torus(0.04 - i * 0.006, 0.007, 3, S(14)), i % 2 ? TECH.coil : TECH.arc, { p: [sx0, top + 0.1 + i * 0.05, sz0], r: [HALF_PI, 0, 0] });
  b.add(geo.sphere(0.03, S(12), 8), TECH.glow, { p: [sx0, top + SPIRE_H + 0.015, sz0] });
  // ---------- Stege zwischen Halle, Turm und Spule; Gelaender am Deckrand ----------
  // walkways between hall, tower and spire; railing on the deck rim
  b.box(0.12, 0.018, 0.04, TECH.gear, [(-0.11 + tx) / 2 + 0.02, top + 0.13, (hz + tz) / 2 + 0.02], [0, 0.95, 0]);
  b.box(0.1, 0.016, 0.035, TECH.gear, [(0.17 + sx0) / 2, top + 0.06, (hz + sz0) / 2], [0, -0.35, 0]);
  if (!low) {
    b.add(geo.torus(R - 0.02, 0.005, 3, S(28)), mat.metalLight, { p: [0, top + 0.035, 0], r: [HALF_PI, 0, 0] });
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + Math.PI / 12;
      b.box(0.008, 0.035, 0.008, TECH.gearDark, [Math.cos(a) * (R - 0.02), top + 0.018, Math.sin(a) * (R - 0.02)]);
    }
  }
  // ---------- Institutsbauten auf dem Rand, je Stufe einer mehr (bis 5) ----------
  // institute buildings on the rim, one more per level (up to 5)
  const slots = [-0.4, 0.55, 1.15, 2.55, 3.25];
  const n = Math.min(slots.length, lv - 1);
  for (let i = 0; i < n; i++) {
    const a = slots[i];
    const x = Math.cos(a) * 0.32, z = Math.sin(a) * 0.32;
    const h = 0.06 + 0.012 * ((i * 5) % 4);
    b.add(geo.cbox(0.09, h, 0.075, 0.012), i % 2 ? TECH.shell : TECH.shellShade, { p: [x, top + h / 2, z], r: [0, -a, 0] });
    b.box(0.055, 0.012, 0.004, mat.window, [x + Math.cos(a) * 0.038, top + h * 0.6, z + Math.sin(a) * 0.038], [0, -a + HALF_PI, 0]);
    b.box(0.075, 0.01, 0.06, L.roof, [x, top + h + 0.005, z], [0, -a, 0]);
  }
  // Fahne der Hauptstadt / flag of the capital
  b.tube([0.33, top, 0.17], [0.33, top + 0.3, 0.17], 0.006, 4, mat.dark);
  b.box(0.11, 0.065, 0.006, L.primary, [0.385, top + 0.265, 0.17]);
  // Ausbau-Module und Strahllinse / upgrade modules and beam lens
  academyModules(b, base, top, low, mods, L.primary);
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
/** Farbe des Terraform-Strahls und der Lichtwelle (Token) / colour of the terraform beam and the light wave (token) */
export const terraformColor = () => col(semantic.velkarTechGlow);
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
