/**
 * Tageszeit aus der Spielrunde: Morgen, Tag, Abend, Nacht in einem Zyklus von vier Runden (deterministisch).
 * Lichtfarben, Sonnenrichtung, Leuchten, Fensterlicht und Dunst gleiten beim Rundenwechsel sanft in den neuen Zustand.
 * Time of day from the game round: dawn, day, dusk, night in a four-round cycle (deterministic).
 * Light colours, sun direction, glow, window light and haze glide smoothly into the new state when the round changes.
 */
import * as THREE from 'three';
import { hex, semantic } from '../design/tokens';
import { SUN } from './config';
import { ATMO } from './atmosphere';

export type DayPhase = 'day' | 'dusk' | 'night' | 'dawn';
/** Reihenfolge ab Runde 1 / order from round 1 */
export const DAY_CYCLE: DayPhase[] = ['day', 'dusk', 'night', 'dawn'];

/** Tageszeit einer Runde (Runde 1 = Tag) / time of day of a round (round 1 = day) */
export function phaseOf(round: number): DayPhase {
  const i = ((Math.floor(round) - 1) % DAY_CYCLE.length + DAY_CYCLE.length) % DAY_CYCLE.length;
  return DAY_CYCLE[i];
}

interface Preset {
  sky: string; ground: string; hemi: number;
  sun: string; sunI: number; sunDir: [number, number, number];
  /** Nachtanteil / night share */
  night: number; glow: number; window: number;
  haze: string; hazeAmt: number;
  /** Licht fuer unbeleuchtete Shader (Wasser) / light for unlit shaders (water) */
  light: [number, number, number];
  bloom: number;
  /**
   * Schlagschatten: Anteil des Sonnen- und des Umgebungslichts, der im Schatten wegfaellt (nachts schwaecher, damit
   * nichts im Dunkeln verschwindet); contact = Staerke der Bodenschatten unter Einheiten und Baeumen.
   * Cast shadows: share of the sun and of the ambient light removed inside a shadow (weaker at night so nothing
   * vanishes in the dark); contact = strength of the contact shadows under units and trees.
   */
  shadow: [number, number];
  contact: number;
}

/**
 * Schatten je Tageszeit, fuer alle Welten gleich: am Tag kraeftig, in der Daemmerung etwas weicher (lange Schatten),
 * nachts und in der Hoehle nur leicht, damit Einheiten und Markierungen lesbar bleiben.
 * Shadows per time of day, the same for all worlds: strong by day, a little softer at dusk and dawn (long shadows),
 * only light at night and in the cavern so units and markers stay readable.
 */
const SHADE: Record<DayPhase | 'cave', Pick<Preset, 'shadow' | 'contact'>> = {
  day: { shadow: [1, 0.15], contact: 0.55 },
  dusk: { shadow: [0.9, 0.1], contact: 0.48 },
  night: { shadow: [0.7, 0.05], contact: 0.4 },
  dawn: { shadow: [0.9, 0.1], contact: 0.48 },
  cave: { shadow: [0.6, 0.05], contact: 0.4 },
};

/*
 * Lichtbalance: wenig Umgebungslicht (hemi) und eine kraeftige Sonne (sunI) geben den Modellen eine helle und eine
 * schattige Seite; die Summe beider bleibt je Stimmung gleich, damit besonnte Flaechen so hell und freundlich sind wie zuvor.
 * Nacht und Hoehle verschieben nur wenig: dort traegt das blaue Umgebungslicht die Stimmung und haelt alles lesbar.
 * Light balance: little ambient light (hemi) and a strong sun (sunI) give the models a lit and a shaded side; their
 * sum stays the same per mood so sunlit surfaces are as bright and friendly as before. Night and cavern shift only a
 * little: there the blue ambient light carries the mood and keeps everything readable.
 */
const PRESETS: Record<DayPhase, Preset> = {
  day: {
    sky: semantic.skyDay, ground: semantic.terrainPlainSide, hemi: 0.95, sun: semantic.sunDay, sunI: 2.85, sunDir: [SUN.x, SUN.y, SUN.z],
    night: 0, glow: 0.3, window: 0, haze: semantic.hazeDay, hazeAmt: 0.22, light: [1, 1, 1], bloom: 0.55, ...SHADE.day,
  },
  dusk: {
    sky: semantic.skyDusk, ground: semantic.terrainPlainSide, hemi: 0.95, sun: semantic.sunDusk, sunI: 2.5, sunDir: [-10, 4.6, -3.5],
    night: 0.45, glow: 0.55, window: 0.8, haze: semantic.hazeDusk, hazeAmt: 0.34, light: [0.92, 0.78, 0.7], bloom: 0.75, ...SHADE.dusk,
  },
  night: {
    sky: semantic.skyNight, ground: semantic.groundNight, hemi: 1.45, sun: semantic.moonLight, sunI: 1.35, sunDir: [4, 9, -6],
    night: 1, glow: 1, window: 1, haze: semantic.hazeNight, hazeAmt: 0.42, light: [0.42, 0.5, 0.78], bloom: 1, ...SHADE.night,
  },
  dawn: {
    sky: semantic.skyDawn, ground: semantic.terrainPlainSide, hemi: 0.98, sun: semantic.sunDawn, sunI: 2.47, sunDir: [8, 5, 8],
    night: 0.25, glow: 0.4, window: 0.45, haze: semantic.hazeDusk, hazeAmt: 0.3, light: [1, 0.9, 0.86], bloom: 0.65, ...SHADE.dawn,
  },
};

/**
 * Hoehle (Kampagnenfinale): kein Himmel und keine Tageszeit; kuehles blau-violettes Umgebungslicht, schwaches Licht
 * von oben, volles Eigenleuchten und dichter Dunst in Hoehlentoenen zum Rand hin.
 * Cavern (campaign finale): no sky and no time of day; cool blue-violet ambient light, a weak light from above,
 * full self glow and dense haze in cave tones towards the edge.
 */
const CAVE: Preset = {
  sky: semantic.caveAmbient, ground: semantic.caveGround, hemi: 0.95, sun: semantic.caveKeyLight, sunI: 1.2, sunDir: [-3, 9, 4],
  night: 1, glow: 1.6, window: 1, haze: semantic.caveHaze, hazeAmt: 0.6, light: [0.42, 0.48, 0.78], bloom: 1.35, ...SHADE.cave,
};

/**
 * Heimatwelt der Zyrr (Thema 'alien'): violetter Himmel, rosa Sonne, violetter Dunst, auch tagsueber leichtes Leuchten.
 * Zyrr homeworld (theme 'alien'): violet sky, pink sun, violet haze, a slight glow even by day.
 */
const ALIEN_PRESETS: Record<DayPhase, Preset> = {
  day: {
    sky: semantic.alienSkyLow, ground: semantic.alienGroundDark, hemi: 0.95, sun: semantic.alienSun, sunI: 2.55, sunDir: [SUN.x, SUN.y, SUN.z],
    night: 0.2, glow: 0.55, window: 0.2, haze: semantic.alienHaze, hazeAmt: 0.3, light: [0.96, 0.86, 1], bloom: 0.75, ...SHADE.day,
  },
  dusk: {
    sky: semantic.alienSkyMid, ground: semantic.alienGroundDark, hemi: 0.95, sun: semantic.alienSun, sunI: 2.35, sunDir: [-10, 4.6, -3.5],
    night: 0.5, glow: 0.75, window: 0.8, haze: semantic.alienHaze, hazeAmt: 0.36, light: [0.9, 0.74, 0.96], bloom: 0.85, ...SHADE.dusk,
  },
  night: {
    sky: semantic.alienSkyHigh, ground: semantic.alienSkyTop, hemi: 1.4, sun: semantic.alienMoon, sunI: 1.3, sunDir: [4, 9, -6],
    night: 1, glow: 1, window: 1, haze: semantic.alienHazeNight, hazeAmt: 0.42, light: [0.5, 0.42, 0.78], bloom: 1, ...SHADE.night,
  },
  dawn: {
    sky: semantic.alienSkyMid, ground: semantic.alienGroundDark, hemi: 0.95, sun: semantic.alienSun, sunI: 2.35, sunDir: [8, 5, 8],
    night: 0.35, glow: 0.65, window: 0.45, haze: semantic.alienHaze, hazeAmt: 0.33, light: [0.94, 0.8, 0.98], bloom: 0.8, ...SHADE.dawn,
  },
};

/**
 * Welt der Vergessenen (Thema 'desert'): staubiger Lachs- bis Ockerhimmel, kleine blasse Sonne, warmer Staubdunst;
 * die Abenddaemmerung ist wie auf dem Mars kuehl blau, die Nacht rostbraun.
 * World of the Forgotten (theme 'desert'): dusty salmon to ochre sky, a small pale sun, warm dust haze;
 * dusk is cool blue like on Mars, the night is rust brown.
 */
const DESERT_PRESETS: Record<DayPhase, Preset> = {
  day: {
    sky: semantic.desertSkyLow, ground: semantic.desertSandDark, hemi: 0.98, sun: semantic.desertSun, sunI: 2.72, sunDir: [SUN.x, SUN.y, SUN.z],
    night: 0, glow: 0.35, window: 0, haze: semantic.desertHaze, hazeAmt: 0.36, light: [1, 0.9, 0.82], bloom: 0.6, ...SHADE.day,
  },
  dusk: {
    sky: semantic.desertSkyMid, ground: semantic.desertRockDark, hemi: 0.95, sun: semantic.desertSunset, sunI: 2.3, sunDir: [-10, 4.6, -3.5],
    night: 0.45, glow: 0.6, window: 0.8, haze: semantic.desertHaze, hazeAmt: 0.42, light: [0.86, 0.76, 0.78], bloom: 0.8, ...SHADE.dusk,
  },
  night: {
    sky: semantic.desertSkyHigh, ground: semantic.desertSkyTop, hemi: 1.36, sun: semantic.desertMoon, sunI: 1.24, sunDir: [4, 9, -6],
    night: 1, glow: 1, window: 1, haze: semantic.desertHazeNight, hazeAmt: 0.44, light: [0.56, 0.44, 0.5], bloom: 1, ...SHADE.night,
  },
  dawn: {
    sky: semantic.desertSkyMid, ground: semantic.desertSandDark, hemi: 0.98, sun: semantic.desertSun, sunI: 2.42, sunDir: [8, 5, 8],
    night: 0.25, glow: 0.45, window: 0.45, haze: semantic.desertHaze, hazeAmt: 0.38, light: [0.98, 0.84, 0.76], bloom: 0.7, ...SHADE.dawn,
  },
};

/** Zahlenform eines Zustands zum Mischen / numeric form of a state for blending */
interface State {
  sky: THREE.Color; ground: THREE.Color; hemi: number; sun: THREE.Color; sunI: number; sunDir: THREE.Vector3;
  night: number; glow: number; window: number; haze: THREE.Color; hazeAmt: number; light: THREE.Color; bloom: number;
  shadowSun: number; shadowAmbient: number; contact: number;
}
const toState = (p: Preset): State => ({
  sky: new THREE.Color(hex(p.sky)), ground: new THREE.Color(hex(p.ground)), hemi: p.hemi,
  sun: new THREE.Color(hex(p.sun)), sunI: p.sunI, sunDir: new THREE.Vector3(...p.sunDir).normalize(),
  night: p.night, glow: p.glow, window: p.window, haze: new THREE.Color(hex(p.haze)), hazeAmt: p.hazeAmt,
  light: new THREE.Color(...p.light), bloom: p.bloom, shadowSun: p.shadow[0], shadowAmbient: p.shadow[1], contact: p.contact,
});
const clone = (s: State): State => ({ ...s, sky: s.sky.clone(), ground: s.ground.clone(), sun: s.sun.clone(), sunDir: s.sunDir.clone(), haze: s.haze.clone(), light: s.light.clone() });

/** Dauer des Uebergangs in ms / transition duration in ms */
const BLEND_MS = 1600;
const SUN_DISTANCE = Math.hypot(SUN.x, SUN.y, SUN.z);

export class Sky {
  phase: DayPhase = 'day';
  private from: State = toState(PRESETS.day);
  private to: State = toState(PRESETS.day);
  private cur: State = toState(PRESETS.day);
  private start = 0;
  private blending = false;
  /** Bewoelkung durch Wetter 0..1 / overcast from weather 0..1 */
  private overcast = 0;
  /** Kartenthema der Partie ('alien' und 'desert' haben eigene Lichtstimmungen) / map theme of the game ('alien' and 'desert' have own light moods) */
  private world: 'cavern' | 'alien' | 'desert' | null = null;
  bloom = PRESETS.day.bloom;

  constructor(private hemi: THREE.HemisphereLight, private sun: THREE.DirectionalLight) {
    this.apply();
  }

  /**
   * Neue Tageszeit setzen; animate = sanft ueberblenden; world = Kartenthema ('cavern' = Hoehlenlicht ohne Tageszeit,
   * 'alien' = Lichtstimmungen der Zyrr-Heimatwelt, 'desert' = Wuestenwelt der Vergessenen).
   * Set a new time of day; animate = blend smoothly; world = map theme ('cavern' = cavern light without time of day,
   * 'alien' = light moods of the Zyrr homeworld, 'desert' = desert world of the Forgotten).
   */
  set(phase: DayPhase, overcast: number, animate: boolean, world: 'cavern' | 'alien' | 'desert' | null = null) {
    if (world === 'cavern') overcast = 0;
    if (phase === this.phase && overcast === this.overcast && world === this.world) return;
    // Wechsel des Kartenthemas (Oberflaeche, Hoehle, Alienwelt) nie ueberblenden / never blend when the map theme changes (surface, cavern, alien world)
    if (world !== this.world) animate = false;
    this.phase = phase;
    this.overcast = overcast;
    this.world = world;
    this.from = clone(this.cur);
    this.to = toState(world === 'cavern' ? CAVE : (world === 'alien' ? ALIEN_PRESETS : world === 'desert' ? DESERT_PRESETS : PRESETS)[phase]);
    this.to.sunI *= 1 - overcast * 0.35;
    this.to.hemi *= 1 - overcast * 0.05;
    this.to.hazeAmt += overcast * 0.08;
    if (!animate) { this.cur = clone(this.to); this.blending = false; this.apply(); return; }
    this.start = performance.now();
    this.blending = true;
  }

  /** Fortschreiben; true, solange sich das Licht aendert / advance; true while the light changes */
  update(now: number): boolean {
    if (!this.blending) return false;
    const k = Math.max(0, Math.min(1, (now - this.start) / BLEND_MS));
    const e = k * k * (3 - 2 * k);
    const a = this.from, b = this.to, c = this.cur;
    c.sky.copy(a.sky).lerp(b.sky, e); c.ground.copy(a.ground).lerp(b.ground, e); c.sun.copy(a.sun).lerp(b.sun, e);
    c.haze.copy(a.haze).lerp(b.haze, e); c.light.copy(a.light).lerp(b.light, e);
    c.sunDir.copy(a.sunDir).lerp(b.sunDir, e).normalize();
    for (const key of ['hemi', 'sunI', 'night', 'glow', 'window', 'hazeAmt', 'bloom', 'shadowSun', 'shadowAmbient', 'contact'] as const) c[key] = a[key] + (b[key] - a[key]) * e;
    if (k >= 1) this.blending = false;
    this.apply();
    return true;
  }

  get changing() { return this.blending; }

  private apply() {
    const c = this.cur;
    this.hemi.color.copy(c.sky);
    this.hemi.groundColor.copy(c.ground);
    this.hemi.intensity = c.hemi;
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.sunI;
    this.sun.position.copy(c.sunDir).multiplyScalar(SUN_DISTANCE);
    ATMO.uNight.value = c.night;
    ATMO.uGlow.value = c.glow;
    ATMO.uWindow.value = c.window;
    ATMO.uHazeColor.value.copy(c.haze);
    ATMO.uLight.value.copy(c.light);
    ATMO.uShadow.value.set(c.shadowSun, c.shadowAmbient);
    ATMO.uContact.value = c.contact;
    // waagerechte Sonnenrichtung fuer den Versatz der Bodenschatten / horizontal sun direction for the offset of the contact shadows
    const flat = Math.hypot(c.sunDir.x, c.sunDir.z);
    if (flat > 1e-4) ATMO.uSunXZ.value.set(c.sunDir.x / flat, c.sunDir.z / flat);
    this.hazeAmount = c.hazeAmt;
    this.bloom = c.bloom;
  }
  /** Dunststaerke (View setzt sie in XR auf 0) / haze amount (View sets it to 0 in XR) */
  hazeAmount = PRESETS.day.hazeAmt;
}
