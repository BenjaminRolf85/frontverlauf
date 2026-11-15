/**
 * Bilder und Schriften des Intros laden: Comic-Seiten (public/lore), Anfuehrer-Portraets (public/leaders/img),
 * Fraktionsembleme (SVG-Symbole aus src/ui/icons.ts als Bild). Fehlt ein Bild, zeichnet der Renderer Ersatzflaechen.
 * Load the intro's images and fonts: comic pages (public/lore), leader portraits (public/leaders/img),
 * faction emblems (SVG icons from src/ui/icons.ts as images). If an image is missing, the renderer draws fallback shapes.
 */
import { factionTokens, primitives } from '../design/tokens';
import { FACTION_EMBLEM, icon } from '../ui/icons';
import { leaderImage } from '../ui/leaders';
import { HUMANS, type HumanFaction } from './timeline';

export interface Pic { img: CanvasImageSource; w: number; h: number }
export type LorePage = 'prolog' | HumanFaction;
export interface IntroAssets {
  lore: Partial<Record<LorePage, Pic>>;
  leaders: Partial<Record<HumanFaction, Pic>>;
  emblems: Partial<Record<HumanFaction, Pic>>;
}

const BASE = `${import.meta.env.BASE_URL ?? '/'}lore/`;

function loadImage(src: string): Promise<Pic | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const done = () => resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
      // vorab dekodiert als ImageBitmap: kein Ruckeln beim ersten Zeichnen / pre-decoded as ImageBitmap: no hitch on the first draw
      const bitmap = () => (typeof createImageBitmap === 'function'
        ? createImageBitmap(img).then((bmp) => resolve({ img: bmp, w: bmp.width, h: bmp.height }), done) : done());
      img.decode ? img.decode().then(bitmap, bitmap) : bitmap();
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Symbol als SVG-Bild in einer Farbe / icon as an SVG image in one colour */
function emblemSrc(f: HumanFaction): string {
  const svg = icon(FACTION_EMBLEM[f], '')
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" ')
    .replace(/currentColor/g, factionTokens[f].ink);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Schriften fuer das Canvas laden (aus @fontsource) / load fonts for the canvas (from @fontsource) */
async function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const f = primitives.font;
  await Promise.all([`64px ${f.display}`, `64px ${f.comic}`, `700 32px ${f.body}`, `400 32px ${f.body}`]
    .map((spec) => document.fonts.load(spec).catch(() => [])));
}

export async function loadIntroAssets(): Promise<IntroAssets> {
  const a: IntroAssets = { lore: {}, leaders: {}, emblems: {} };
  const pages: LorePage[] = ['prolog', ...HUMANS];
  await Promise.all([
    loadFonts(),
    ...pages.map(async (p) => { const pic = await loadImage(`${BASE}${p}.webp`); if (pic) a.lore[p] = pic; }),
    ...HUMANS.map(async (f) => { const pic = await loadImage(leaderImage(f)); if (pic) a.leaders[f] = pic; }),
    ...HUMANS.map(async (f) => { const pic = await loadImage(emblemSrc(f)); if (pic) a.emblems[f] = pic; }),
  ]);
  return a;
}
