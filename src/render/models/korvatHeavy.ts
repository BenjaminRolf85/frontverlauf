/**
 * Steppenkoloss der Korvat: ueberschwerer Mehrturm-Panzer (Landkreuzer der Steppe). Lange, hohe, genietete Wanne mit
 * Kettenschuerzen und rotem Stern, sieben Laufrollen je Seite, grosser Gussturm mit EINEM Langrohr und Muendungsbremse,
 * vorn links und hinten rechts je ein kleiner MG-Turm, Fasser und Ersatzketten wie beim Korvat-Panzer.
 * Korvat's Steppe Colossus: super-heavy multi-turret tank (a land cruiser of the steppe). Long, tall, riveted hull with
 * track skirts and a red star, seven road wheels per side, a big cast turret with ONE long gun and muzzle brake, a small
 * MG turret front left and rear right, fuel drums and spare tracks like the Korvat tank.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, shade, type ColorLike } from './kit';
import { look, mat, type Look } from './look';
import { antenna, commander, cupola, gun, tracks } from './tanks';

const HALF_PI = Math.PI / 2;

/** Kleiner MG-Turm auf dem Wannendach / small MG turret on the hull roof */
function mgTurret(b: Builder, L: Look, x: number, y: number, z: number, ang: number, lite: boolean) {
  b.cyl(0.05, 0.055, 0.04, lite ? 8 : 12, L.hull, [x, y + 0.02, z]);
  b.cyl(0.042, 0.05, 0.012, lite ? 8 : 12, L.hullDark, [x, y + 0.046, z]);
  b.group({ p: [x, y + 0.024, z], r: [0, ang, 0] }, () => {
    b.add(geo.cbox(0.03, 0.026, 0.04, 0.006), L.hullDark, { p: [0, 0, 0.05] });
    b.cyl(0.008, 0.009, 0.09, lite ? 6 : 8, mat.dark, [0, 0, 0.1], [HALF_PI, 0, 0]);
    if (!lite) b.cyl(0.012, 0.012, 0.016, 8, mat.ink, [0, 0, 0.145], [HALF_PI, 0, 0]);
  });
}

export function steppeColossus(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const fid: FactionId = L.id === 'neutral' ? 'korvat' : L.id;
  const star = L.primary;
  // breite, lange Ketten mit sieben Rollen / wide, long tracks with seven wheels
  tracks(b, { x: 0.15, w: 0.1, len: 0.5, h: 0.105, wheels: 7, wr: 0.034, sprocket: L.trim, hub: L.hullDark, lite, links: 13, rollers: 4 });
  // hohe Kastenwanne / tall box hull
  b.add(geo.profileZY([[-0.24, 0.04], [0.18, 0.04], [0.25, 0.11], [0.22, 0.175], [-0.22, 0.175], [-0.25, 0.13]], 0.22), L.hull);
  b.block(0, 0.105, 0, 0.44, 0.016, 0.5, L.hull);
  // Kettenschuerzen mit Nietenreihe und Stern / track skirts with a rivet row and a star
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.014, 0.07, 0.46, 0.004), shade(L.hull, 0.92), { p: [s * 0.208, 0.082, 0] });
    b.box(0.016, 0.008, 0.46, L.trim, [s * 0.208, 0.118, 0]);
    if (!lite) {
      for (let i = 0; i < 10; i++) b.box(0.006, 0.006, 0.006, L.hullDark, [s * 0.216, 0.1, -0.2 + i * 0.044]);
      addEmblem(b, fid, 0.04, 0.006, star, { p: [s * 0.217, 0.075, 0.02], r: [0, s * HALF_PI, 0] });
    }
  }
  // Oberwanne / upper hull
  b.add(geo.rtaper(0.36, 0.4, 0.33, 0.36, 0.035, 0.008), L.hull, { p: [0, 0.192, -0.01] });
  if (!lite) {
    // Ersatzketten auf der Bugplatte, Scheinwerfer / spare tracks on the glacis, headlights
    b.group({ p: [0, 0.14, 0.232], r: [0.8, 0, 0] }, () => {
      for (let i = 0; i < 3; i++) {
        b.box(0.17, 0.012, 0.02, mat.dark, [0, 0, -0.025 + i * 0.026]);
        for (const x of [-0.06, 0, 0.06]) b.box(0.008, 0.016, 0.008, mat.metal, [x, 0.002, -0.025 + i * 0.026]);
      }
    });
    for (const s of [-1, 1]) {
      b.add(geo.cbox(0.03, 0.022, 0.02, 0.005), mat.dark, { p: [s * 0.16, 0.135, 0.236] });
      b.box(0.022, 0.016, 0.004, mat.yellow, [s * 0.16, 0.135, 0.247]);
    }
    // Fasser am Heck, Motorgitter, Auspuff / fuel drums at the rear, engine grille, exhaust
    for (const s of [-1, 1]) {
      b.cyl(0.032, 0.032, 0.12, 10, L.trim, [s * 0.07, 0.205, -0.235], [0, 0, HALF_PI]);
      b.cyl(0.034, 0.034, 0.012, 10, L.primaryDark, [s * 0.07, 0.205, -0.235], [0, 0, HALF_PI]);
      b.cyl(0.013, 0.015, 0.06, 8, mat.darkMid, [s * 0.16, 0.22, -0.2]);
    }
    for (let i = 0; i < 4; i++) b.box(0.18, 0.006, 0.01, mat.ink, [0, 0.211, -0.13 - i * 0.022]);
    // Nieten an der Oberwanne / rivets on the upper hull
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) b.box(0.006, 0.006, 0.006, L.hullDark, [s * 0.172, 0.2, -0.16 + i * 0.045]);
  }
  // kleine MG-Tuerme vorn links und hinten rechts / small MG turrets front left and rear right
  mgTurret(b, L, -0.105, 0.21, 0.13, -0.25, lite);
  mgTurret(b, L, 0.105, 0.21, -0.14, 0.4, lite);
  // grosser Gussturm, mittig / big cast turret, centred
  const ty = 0.21, tz = -0.02;
  b.add(geo.rtaper(0.25, 0.26, 0.19, 0.19, 0.1, 0.03, 0.005), L.hull, { p: [0, ty + 0.05, tz] });
  b.add(geo.cyl(0.13, 0.13, 0.014, lite ? 10 : 16, true), L.trim, { p: [0, ty + 0.012, tz] });
  b.add(geo.rbox(0.13, 0.07, 0.06, 0.018), L.hullDark, { p: [0, ty + 0.05, tz + 0.13] });
  // EIN Langrohr mit grosser Muendungsbremse / ONE long gun with a big muzzle brake
  gun(b, 0, ty + 0.055, tz + 0.15, 0.27, 0.019, L.hullDark, { brake: 'big', sleeves: 2, lite });
  if (!lite) {
    // roter Ring und Stern am Turm / red band and star on the turret
    b.add(geo.cyl(0.118, 0.118, 0.01, 16, true), star, { p: [0, ty + 0.075, tz] });
    for (const s of [-1, 1]) addEmblem(b, fid, 0.036, 0.006, L.emblem, { p: [s * 0.122, ty + 0.05, tz - 0.01], r: [0, s * HALF_PI, 0] });
    // Nieten, Staukorb, Kuppel mit Kommandant, Antenne / rivets, stowage basket, cupola with commander, antenna
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.box(0.007, 0.007, 0.007, L.hullDark, [Math.sin(a) * 0.118, ty + 0.032, tz + Math.cos(a) * 0.118]);
    }
    b.add(geo.cbox(0.18, 0.035, 0.045, 0.006), L.trim, { p: [0, ty + 0.04, tz - 0.14] });
    for (const x of [-0.06, 0, 0.06]) b.box(0.006, 0.037, 0.047, mat.dark, [x, ty + 0.04, tz - 0.14]);
    cupola(b, L, -0.055, ty + 0.1, tz - 0.04, 0.036, lite);
    commander(b, fid, -0.055, ty + 0.11, tz - 0.04, 11);
    for (const x of [-0.075, 0.075]) b.add(geo.cbox(0.022, 0.016, 0.016, 0.004), mat.dark, { p: [x, ty + 0.105, tz + 0.05] });
    antenna(b, 0.08, ty + 0.1, tz - 0.1, 0.22, L.trim as ColorLike);
  }
  return b;
}
