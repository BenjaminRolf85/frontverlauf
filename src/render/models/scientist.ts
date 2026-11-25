/**
 * Wissenschaftler (Kampagne m2): Laborkittel, Schutzbrille auf der Stirn, wirres Haar, Messkoffer und Abtaststab.
 * Fraktionsfarben an Kragen, Armbinde, Brillenband, Hose und Koffer; der Kittel selbst bleibt weiss.
 * Scientist (campaign m2): lab coat, goggles on the forehead, wild hair, instrument case and scanner wand.
 * Faction colours on collar, armband, goggle strap, trousers and case; the coat itself stays white.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { face, type Detail } from './headgear';
import { Builder, fine, geo, mix, rng, shade, type V3 } from './kit';
import { look, mat, type Look } from './look';
import { soldier, standPose } from './soldiers';

const HALF_PI = Math.PI / 2;

/** Kopf: Gesicht, wirres Haar, Schutzbrille auf der Stirn / head: face, wild hair, goggles pushed up on the forehead */
function scientistHead(b: Builder, L: Look, d: Detail) {
  const R = rng(91);
  const hair = mix(mat.paper, mat.dark, 0.25);
  face(b, d, 'none', 91, { hair });
  const ws = d === 2 ? 14 : 10;
  // Haarkappe und abstehende Buesche / hair cap and sticking-out tufts
  b.add(geo.hemi(0.058, ws, d === 2 ? 5 : 3), hair, { p: [0, 0.085, -0.008], s: [1.02, 0.8, 1.05] });
  const tufts = d === 2 ? 7 : 4;
  for (let i = 0; i < tufts; i++) {
    const a = (i / tufts) * Math.PI * 2 + 0.3;
    b.add(geo.cone(0.018, 0.045 + R() * 0.02, 5), hair, { p: [Math.cos(a) * 0.05, 0.075, Math.sin(a) * 0.05 - 0.01], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1] });
  }
  if (fine() && d === 2) {
    // hohe Qualitaet: wirre Straehnen statt weniger Kegel, buschige Brauen / high quality: wild strands instead of a few cones, bushy brows
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      const root: V3 = [Math.cos(a) * 0.046, 0.08 + R() * 0.02, Math.sin(a) * 0.048 - 0.012];
      const tip: V3 = [Math.cos(a) * (0.075 + R() * 0.02), 0.07 + R() * 0.05, Math.sin(a) * (0.072 + R() * 0.02) - 0.018];
      if (Math.sin(a) > 0.75) continue;
      b.tube(root, tip, 0.008, 5, i % 3 ? hair : shade(hair, 0.85), 0.002);
    }
  }
  // Schutzbrille mit Band in Fraktionsfarbe / goggles with a strap in the faction colour
  b.add(geo.cyl(0.056, 0.056, 0.014, ws, true), L.primary, { p: [0, 0.09, -0.004], r: [-0.25, 0, 0] });
  for (const s of [-1, 1]) {
    b.cyl(0.02, 0.022, 0.018, d === 2 ? 12 : 8, mat.metal, [s * 0.025, 0.1, 0.05], [HALF_PI - 0.25, 0, 0]);
    b.cyl(0.015, 0.015, 0.004, d === 2 ? 12 : 8, mix(mat.glass, mat.white, 0.3), [s * 0.025, 0.103, 0.059], [HALF_PI - 0.25, 0, 0]);
  }
  b.box(0.012, 0.008, 0.01, mat.metal, [0, 0.1, 0.05]);
}

export function scientist(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const d: Detail = lite ? 1 : 2;
  const coat = mix(mat.white, mat.paper, 0.35);
  b.group({ p: [-0.04, 0, 0] }, () => {
    soldier(b, f, {
      ...standPose([[-0.1, 0.17, 0.09], [0.12, 0.11, 0.02]]),
      twist: [0, -0.18, 0],
      head: [0.08, -0.2, 0],
    }, { detail: d, coat: true, coatColor: coat, armband: true, seed: 91, head: scientistHead });
    // Kragen und Brusttasche mit Stiften / collar and breast pocket with pens
    b.box(0.07, 0.014, 0.05, L.primary, [0, 0.29, 0.02], [0.3, -0.18, 0]);
    if (!lite) {
      b.box(0.03, 0.026, 0.008, shade(coat, 0.85), [0.035, 0.235, 0.05], [0, -0.18, 0]);
      for (const [x, c] of [[0.028, L.secondary], [0.04, mat.red]] as const) b.box(0.004, 0.024, 0.004, c, [x, 0.25, 0.052], [0, -0.18, 0]);
    }
    // Abtaststab in der linken Hand mit Saeurespitze / scanner wand in the left hand with an acid tip
    b.tube([-0.1, 0.17, 0.09], [-0.12, 0.25, 0.2], 0.008, 6, mat.metal, 0.006);
    b.add(geo.rbox(0.03, 0.022, 0.04, 0.006), mat.dark, { p: [-0.1, 0.165, 0.08] });
    b.add(geo.ico(0.013, 0), mat.acid, { p: [-0.122, 0.253, 0.205] });
    // Messkoffer in der rechten Hand / instrument case in the right hand
    b.add(geo.rbox(0.045, 0.075, 0.1, 0.01), L.primary, { p: [0.13, 0.068, 0.02] });
    b.add(geo.rbox(0.047, 0.012, 0.102, 0.004), mat.metal, { p: [0.13, 0.1, 0.02] });
    b.box(0.012, 0.014, 0.04, mat.dark, [0.13, 0.112, 0.02]);
    for (const z of [-0.015, 0.055]) b.box(0.05, 0.016, 0.008, mat.metalLight, [0.13, 0.085, z]);
    // Messinstrument auf dem Koffer: kleine Anzeige / meter on the case: small dial
    b.cyl(0.014, 0.014, 0.006, 10, mat.white, [0.154, 0.065, 0.02], [0, 0, HALF_PI]);
    b.box(0.003, 0.012, 0.002, mat.red, [0.158, 0.068, 0.02], [0.5, 0, 0]);
    if (!lite) addEmblem(b, f, 0.016, 0.004, L.secondary, { p: [0.154, 0.068, -0.02], r: [0, HALF_PI, 0] });
  });
  return b;
}
