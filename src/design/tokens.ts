/**
 * Design-Tokens in drei Ebenen: Grundwerte -> semantische Tokens -> Komponenten-Tokens.
 * Design tokens in three layers: primitives -> semantic tokens -> component tokens.
 *
 * Einzige Quelle fuer Farben, Abstaende, Schriften, Radien, Schatten und Dauern.
 * Die CSS Custom Properties (tokens.css) werden mit `npm run tokens` daraus erzeugt,
 * die 3D-Szene und die XR-Panels lesen die Werte direkt aus diesem Modul.
 * Single source for colours, spacing, fonts, radii, shadows and durations.
 * The CSS custom properties (tokens.css) are generated from it with `npm run tokens`,
 * the 3D scene and the XR panels read the values from this module directly.
 */
import type { FactionId } from '../data/balance';

// ---------- Ebene 1: Grundwerte / layer 1: primitives ----------
export const primitives = {
  color: {
    ink900: '#15131f',
    ink800: '#24212f',
    ink700: '#3a3647',
    ink500: '#6a6578',
    paper50: '#f8f2dc',
    paper100: '#efe6c6',
    paper200: '#e2d4a6',
    paper300: '#cdb97e',
    // Militaer / military
    olive900: '#1c2112',
    olive800: '#262c18',
    olive700: '#363e22',
    olive600: '#4b5320',
    olive500: '#6b7445',
    olive400: '#8a9160',
    khaki500: '#b8a46a',
    stampRed: '#a3271c',
    blood500: '#b3141c',
    blood700: '#7a0d12',
    bone100: '#f1ead2',
    char800: '#2b2622',
    fire400: '#ff8a1f',
    yellow400: '#ffd23f',
    yellow500: '#f5b700',
    red500: '#e2412e',
    red700: '#a8261a',
    blue400: '#4aa3ff',
    blue600: '#1f5fbf',
    green500: '#3fae4a',
    green700: '#2a7a32',
    teal500: '#1fa6a0',
    orange500: '#f08a24',
    sky900: '#141a33',
    sky800: '#1d2648',
    sky700: '#2a3766',
    white: '#ffffff',
    // Gelaende / terrain
    grass400: '#8fcf5a',
    grass500: '#74b844',
    forest500: '#3f8f3a',
    forest700: '#2b6a2a',
    rock400: '#a49a8c',
    rock600: '#7b7064',
    snow100: '#f4f6f8',
    sand300: '#e9d39a',
    water300: '#5fd0e8',
    water500: '#2ea3d1',
    water700: '#1a6fa8',
    desert300: '#f0cf7a',
    desert500: '#d9a845',
    steppe300: '#c9c96a',
    steppe500: '#a8a24a',
    tundra100: '#e8f1f4',
    tundra300: '#b9cfd6',
    swamp400: '#6f8f4a',
    swamp600: '#4c6a3a',
    hills400: '#7cc04d',
    cactus500: '#4f9a4a',
    reed500: '#8a8f3a',
    river400: '#4cc3e6',
    flowerRed: '#e8483b',
    flowerYellow: '#ffd23f',
    flowerWhite: '#fbf7ec',
    flowerViolet: '#9b6fd6',
    grass600: '#5aa63a',
    track700: '#5d5240',
    asphalt700: '#3d4048',
    asphalt500: '#585c66',
    track500: '#8a7c60',
    cloud100: '#ffffff',
    cloud300: '#dfe6f2',
    // Fraktionen / factions
    korvatRed: '#c8372d',
    korvatOlive: '#6b7a3a',
    dravonAnthracite: '#3a3d42',
    dravonCamo: '#4d5c2e',
    dravonBlack: '#1c1d20',
    dravonGold: '#d4a72c',
    alveniaBlue: '#2f6fc4',
    alveniaWhite: '#f2f5fa',
    meridonTeal: '#1fa6a0',
    meridonOrange: '#f08a24',
    velkarIce: '#aab8c2',
    velkarGreen: '#8fd16a',
  },
  font: {
    display: "'Black Ops One', 'Bangers', 'Impact', 'Arial Black', sans-serif",
    comic: "'Bangers', 'Impact', 'Arial Black', sans-serif",
    body: "'Comic Neue', 'Trebuchet MS', 'Segoe UI', sans-serif",
  },
  fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '20px', xl: '26px', xxl: '36px', hero: '56px' },
  fontWeight: { regular: '400', bold: '700' },
  letterSpacing: { display: '0.03em', body: '0' },
  space: { 0: '0px', half: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '24px', 6: '32px', 7: '48px' },
  radius: { sm: '6px', md: '12px', lg: '18px', pill: '999px' },
  borderWidth: { thin: '2px', thick: '3px', heavy: '4px' },
  shadow: {
    pop: '4px 4px 0 0',
    popSm: '2px 2px 0 0',
    popLg: '6px 6px 0 0',
  },
  duration: { instant: '1ms', fast: '120ms', base: '200ms', slow: '320ms', max: '400ms' },
  size: { touch: '44px', touchLg: '56px', icon: '24px', iconSm: '18px', bar: '52px' },
  /** Umbruchpunkte (nur Dokumentation, CSS-Media-Queries koennen keine Variablen lesen) / breakpoints */
  breakpoint: { narrow: '480px', sm: '560px', lg: '900px', compactHeight: '520px' },
  z: { map: '0', hud: '10', sheet: '20', dialog: '30', toast: '40', overlay: '50' },
} as const;

const c = primitives.color;

// ---------- Ebene 2: semantische Tokens / layer 2: semantic tokens ----------
export const semantic = {
  surface: c.paper100,
  surfaceRaised: c.paper50,
  surfaceSunken: c.paper200,
  surfaceInverse: c.olive800,
  backdrop: 'rgba(21, 19, 31, 0.62)',
  text: c.ink900,
  textMuted: c.ink700,
  textInverse: c.paper50,
  outline: c.ink900,
  accent: c.yellow400,
  accentStrong: c.yellow500,
  info: c.blue600,
  success: c.green700,
  warning: c.orange500,
  danger: c.red700,
  dangerBright: c.red500,
  focus: c.blue400,
  worldBackground: c.olive900,
  worldBackgroundTop: c.olive700,
  camo1: c.olive800,
  camo2: c.olive600,
  camo3: c.olive500,
  stamp: c.stampRed,
  hazard: c.yellow500,
  splatter: c.blood500,
  splatterDark: c.blood700,
  bone: c.bone100,
  char: c.char800,
  fire: c.fire400,
  oil: c.ink900,
  rivet: c.olive500,
  // 3D-Szene / 3D scene
  ink: c.ink900,
  terrainPlain: c.grass400,
  terrainPlainSide: c.sand300,
  terrainForest: c.grass500,
  tree: c.forest500,
  treeDark: c.forest700,
  terrainMountain: c.rock400,
  terrainMountainDark: c.rock600,
  snow: c.snow100,
  biomeDesert: c.desert300,
  biomeDesertDark: c.desert500,
  biomeSteppe: c.steppe300,
  biomeSteppeDark: c.steppe500,
  biomeTundra: c.tundra100,
  biomeTundraDark: c.tundra300,
  biomeSwamp: c.swamp400,
  biomeSwampDark: c.swamp600,
  biomeHills: c.hills400,
  cactus: c.cactus500,
  reed: c.reed500,
  river: c.river400,
  flowerA: c.flowerRed,
  flowerB: c.flowerYellow,
  flowerC: c.flowerWhite,
  flowerD: c.flowerViolet,
  grassTuft: c.grass600,
  trackFresh: c.track700,
  asphalt: c.asphalt700,
  asphaltEdge: c.asphalt500,
  roadLine: c.white,
  roadCenter: c.yellow400,
  trackOld: c.track500,
  terrainShallow: c.water300,
  terrainOcean: c.water500,
  terrainDeep: c.water700,
  soil: c.ink700,
  cloud: c.cloud100,
  cloudShade: c.cloud300,
  highlightMove: c.green500,
  highlightAttack: c.red500,
  highlightSafe: c.blue400,
  highlightUnsafe: c.orange500,
  highlightSelect: c.yellow400,
  neutral: c.paper300,
  neutralDark: c.ink500,
  metal: c.ink500,
  white: c.white,
} as const;

/** marker = gut sichtbare Markierungsfarbe fuer eigene Einheiten / well visible marker colour for own units */
export interface FactionTokens { primary: string; secondary: string; terrain: string; ink: string; marker: string }
export const factionTokens: Record<FactionId, FactionTokens> = {
  korvat: { primary: c.korvatRed, secondary: c.korvatOlive, terrain: '#a6c95a', ink: c.white, marker: c.red500 },
  dravon: { primary: c.dravonCamo, secondary: c.dravonGold, terrain: '#a9b07a', ink: c.white, marker: c.yellow400 },
  alvenia: { primary: c.alveniaBlue, secondary: c.alveniaWhite, terrain: '#86cf7a', ink: c.white, marker: c.blue400 },
  meridon: { primary: c.meridonTeal, secondary: c.meridonOrange, terrain: '#9ad28a', ink: c.ink900, marker: c.orange500 },
  velkar: { primary: c.velkarIce, secondary: c.velkarGreen, terrain: '#9ec9a0', ink: c.ink900, marker: c.velkarGreen },
};

// ---------- Ebene 3: Komponenten-Tokens / layer 3: component tokens ----------
export const components = {
  button: {
    bg: semantic.accent,
    bgHover: semantic.accentStrong,
    bgSecondary: c.paper100,
    bgDanger: semantic.dangerBright,
    text: semantic.text,
    textDanger: c.white,
    border: semantic.outline,
    borderWidth: primitives.borderWidth.thick,
    radius: primitives.radius.md,
    shadow: `${primitives.shadow.pop} ${semantic.outline}`,
    shadowPressed: `${primitives.shadow.popSm} ${semantic.outline}`,
    minSize: primitives.size.touch,
    paddingX: primitives.space[4],
    font: primitives.font.display,
    fontSize: primitives.fontSize.md,
  },
  iconButton: { size: primitives.size.touch, sizeLg: primitives.size.touchLg, iconSize: primitives.size.icon },
  panel: {
    bg: semantic.surfaceRaised,
    border: semantic.outline,
    borderWidth: primitives.borderWidth.thick,
    radius: primitives.radius.lg,
    shadow: `${primitives.shadow.popLg} ${semantic.outline}`,
    padding: primitives.space[4],
    titleFont: primitives.font.display,
    titleSize: primitives.fontSize.xl,
  },
  actionBar: { bg: semantic.surface, height: '92px', gap: primitives.space[2] },
  topBar: { bg: semantic.surfaceInverse, text: semantic.textInverse, height: primitives.size.bar, stripe: '8px' },
  camo: { size: '220px' },
  rivet: { size: '5px', inset: '10px' },
  stamp: { border: primitives.borderWidth.thick, rotate: '-2deg' },
  dialog: { width: '520px', backdrop: semantic.backdrop },
  toast: { bg: semantic.surfaceInverse, text: semantic.textInverse, accent: semantic.accent },
  progress: { track: semantic.surfaceSunken, fill: semantic.success, height: '12px' },
  resource: { starColor: semantic.accentStrong },
  techNode: {
    researched: c.green500,
    available: c.yellow400,
    locked: c.paper300,
    expensive: c.orange500,
    size: '68px',
  },
  unitCard: { bg: semantic.surfaceRaised, hpFill: c.green500, hpLow: c.red500 },
  halftone: { dot: 'rgba(21, 19, 31, 0.12)', size: '8px', dotRadius: '1px', dotFade: '1.3px' },
  action: { minSize: '76px', minSizeDesktop: '92px', minSizeCompact: '64px', heightCompact: '60px', iconSize: primitives.size.icon },
  layout: {
    sheetMaxWidth: '760px', dialogWide: '980px', toastOffset: '56px', toastWidth: '460px', bubbleWidth: '520px',
    menuWidth: '380px', formWidth: '640px', techMaxWidth: '860px', progressMinWidth: '80px', badgeIcon: '32px',
  },
  fx: { burstSize: '120px', burstStroke: '3' },
  bark: { maxWidth: '220px' },
  techTree: { fontSize: '11px', costSize: '20px', stroke: '3', strokeDone: '5', strokeSelected: '6' },
} as const;

// ---------- Ausgabe / output ----------
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();

/** Flache Liste aller Tokens als CSS-Variablen / flat list of all tokens as CSS variables */
export function tokenEntries(): [string, string][] {
  const out: [string, string][] = [];
  const walk = (prefix: string, obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      const name = `${prefix}-${kebab(String(k))}`;
      if (typeof v === 'object' && v !== null) walk(name, v as Record<string, unknown>);
      else out.push([name, String(v)]);
    }
  };
  walk('--p', primitives as unknown as Record<string, unknown>);
  walk('--s', semantic as unknown as Record<string, unknown>);
  for (const [id, ft] of Object.entries(factionTokens)) walk(`--faction-${id}`, ft as unknown as Record<string, unknown>);
  walk('--c', components as unknown as Record<string, unknown>);
  return out;
}

export function tokensCss(): string {
  return `/* Automatisch erzeugt aus src/design/tokens.ts - nicht von Hand bearbeiten. */\n` +
    `/* Generated from src/design/tokens.ts - do not edit by hand. */\n:root {\n` +
    tokenEntries().map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n';
}

/** Farbe als Zahl fuer Three.js / colour as number for Three.js */
export function hex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

/** Dauer in Millisekunden / duration in milliseconds */
export function ms(d: string): number {
  return parseFloat(d);
}
