/**
 * Nur Filmexport (Anime-Schnitt): Verzeichnis der Filmfiguren. Name -> Erzeuger; export-models.ts traegt sie als Modelle
 * ein, Figuren mit Skelett bekommen dort Gewichte und Knochen in die Ausgabe (figureKit.figureExtras).
 * Film export only (anime cut): directory of the film figures. Name -> maker; export-models.ts registers them as models,
 * figures with a skeleton get weights and bones into the output there (figureKit.figureExtras).
 */
import type * as THREE from 'three';
import { withLod } from './figureKit';
import { buildBanner, buildHorse, buildSoldier } from './figureArmy';
import { atlasOnly, buildFigure, FACES } from './figureKorvat';

/** Feinheit der Figuren in der Menge / fineness of the figures in a crowd */
const CROWD = 0.5;

export const FIGURES: Record<string, () => THREE.BufferGeometry> = {
  fig_korvat_body: () => buildFigure('body'),
  fig_korvat_head: () => buildFigure('head'),
  fig_korvat_cape: () => buildFigure('cape'),
  // Heer der Korvat: Reiter, Infanterist, Pferd, Banner / the Korvat army: rider, infantryman, horse, banner
  fig_korvat_rider: () => withLod(CROWD, () => buildSoldier('rider')),
  fig_korvat_lancer: () => withLod(CROWD, () => buildSoldier('lancer')),
  fig_korvat_officer: () => withLod(CROWD, () => buildSoldier('officer')),
  fig_korvat_foot: () => withLod(CROWD, () => buildSoldier('foot')),
  // derselbe Soldat in voller Feinheit (steht nah bei der Kamera) / the same soldier at full fineness (stands close to the camera)
  fig_korvat_guard: () => buildSoldier('foot'),
  fig_korvat_horse: () => buildHorse(),
  fig_korvat_banner: () => buildBanner(),
};
// weitere Gesichtszeichnungen: nur der Atlas / further face drawings: the atlas only
for (const face of Object.keys(FACES)) if (face !== 'neutral') FIGURES[`figatlas_korvat_head_${face}`] = () => atlasOnly(face);
