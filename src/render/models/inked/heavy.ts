/**
 * Gezeichnete Einheiten: Radarwagen der Meridon und Steppenkoloss der Korvat / inked units: Meridon's radar truck and Korvat's Steppe Colossus.
 *
 * - Radarwagen: sechsraedriger Lastwagen mit Fahrerhaus und dunklem Kofferaufbau, darauf auf einem Drehkranz der hohe
 *   Mast mit der grossen, zum Ziel geneigten Schuessel (Drehturm). Die Schuessel ist innen hohl (umgedrehter Loft) und
 *   traegt die Speichenzeichnung; das Fahrerhaus ist geschlossen, eine Besatzung ist nicht zu sehen.
 * - Steppenkoloss: ueberschwerer Panzer auf dem Wannenbau des Korvat-Panzers mit dessen Zellen: lange hohe Wanne, sieben
 *   Laufrollen, grosser Gussturm mit EINEM Langrohr, zwei kleine MG-Tuerme, Faesser am Heck, Kommandant im Luk.
 * - Radar truck: six-wheeled lorry with cab and dark box body, on it a turntable carrying the tall mast with the large
 *   dish tilted towards the target (turret). The dish is hollow inside (flipped loft) and carries the spoke drawing;
 *   the cab is closed, no crew is visible.
 * - Steppe Colossus: super-heavy tank on the Korvat tank's hull construction with its cells: long tall hull, seven road
 *   wheels, big cast turret with ONE long gun, two small MG turrets, drums at the rear, commander in the hatch.
 */
import type { FactionId } from '../../../data/balance';
import { fine, mix, shade, softBox, type V3 } from '../kit';
import { look, mat, type Look } from '../look';
import { block, boxed, cupola, flipped, hullZ, machineGun, TIP, tube } from './body';
import { headlight, wheelPair } from './car';
import { ringZ, tankGear, tankHull, hullFittings, type HullSpec } from './tanks';
import { barrel, digitDecal, emblemDecal, fuelDrum, type TrackSpec } from './trim';
import { AtlasLayout, loft, loftAt, projectBox, UvBuilder, type Ring } from './uvkit';

const HALF_PI = Math.PI / 2;

// ---------- Radarwagen / radar truck ----------

/** Radarwagen; A = Atlas der Radfahrzeuge / radar truck; A = atlas of the wheeled vehicles */
export function radarTruck(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const wr = 0.056, by = wr + 0.034;
  const grey = mix(L.primaryDark, mat.ink, 0.45);
  for (const z of [0.158, 0.02, -0.146]) wheelPair(b, A, 0.128, z, wr, 0.044, L.trim);
  b.add(block(0.21, 0.036, 0.42, 0.006), L.hullDark, { xf: { p: [0, wr + 0.014, 0.002] } });
  // Fahrerhaus: Tuer gezeichnet, Grill am Bug, dunkle Scheibe / cab: door drawn, grille at the bow, dark screen
  b.add(hullZ([
    { z: 0.222, w: 0.094, up: 0.03, down: 0.046, cy: by + 0.046, e: 5, hard: true },
    { z: 0.21, w: 0.102, up: 0.04, down: 0.05, cy: by + 0.05, e: 5 },
    { z: 0.165, w: 0.106, up: 0.06, down: 0.05, cy: by + 0.05, e: 5 },
    { z: 0.092, w: 0.106, up: 0.064, down: 0.05, cy: by + 0.05, e: 5, hard: true },
  ], { px: A.get('hatchSquare'), nx: A.get('hatchSquare'), pz: A.get('carFront'), all: A.get('blank'), seg: hi ? 18 : 9, capFirst: true, capLast: true }), L.hull);
  b.add(boxed(softBox(0.176, 0.046, 0.005, 0.002), { p: [0, by + 0.086, 0.192], r: [-0.82, 0, 0] }, { pz: A.get('glass'), py: A.get('glass'), all: A.get('blank') }), mat.glassDark, { gloss: 0.4, crease: 0 });
  for (const s of [-1, 1]) headlight(b, A, [s * 0.07, by + 0.016, 0.224], 0.011, L.hullDark);
  b.add(block(0.22, 0.02, 0.02, 0.005), mat.dark, { xf: { p: [0, wr + 0.006, 0.228] } });
  // Kofferaufbau in dunklem Grau mit Dach in der Zweitfarbe / box body in dark grey with a roof in the secondary colour
  const bz = -0.062, bl = 0.27, bh = 0.108;
  b.add(boxed(softBox(0.222, bh, bl, 0.01, hi ? 1 : 0), { p: [0, by + bh / 2, bz] }, { px: A.get('canvas'), nx: A.get('canvas'), nz: A.get('carRear'), pz: A.get('blank'), py: A.get('plate'), ny: A.get('blank') }), grey);
  b.add(boxed(block(0.228, 0.01, bl + 0.006, 0.003), { p: [0, by + bh + 0.004, bz] }, { py: A.get('plate'), all: A.get('blank') }), L.trim);
  for (const s of [-1, 1]) emblemDecal(b, A, f, [s * 0.1115, by + 0.06, -0.01], [s, 0, 0], 0.04, grey);
  // Antennen, Generator / antennas, generator
  tube(b, A, [-0.092, by + bh, -0.18], [-0.092, by + bh + 0.17, -0.19], 0.003, 0.002, mat.dark, hi ? 5 : 3);
  if (hi) tube(b, A, [0.092, by + bh, -0.18], [0.092, by + bh + 0.13, -0.19], 0.003, 0.002, mat.dark, 5);
  b.add(block(0.054, 0.04, 0.054, 0.008), mat.darkMid, { xf: { p: [0.062, by + bh + 0.028, 0.03] } });
  // Schuessel auf Drehkranz und Mast: Drehturm, zeigt zum Ziel / dish on turntable and mast: turret, points at the target
  const ty = by + bh + 0.008, rz = -0.108;
  b.turret([0, ty, rz], () => {
    b.group({ p: [0, ty, rz] }, () => {
      b.add(loft([{ y: 0.03, rx: 0.038, hard: true }, { y: 0.03, rx: 0.044, hard: true }, { y: 0, rx: 0.05 }], { seg: hi ? 14 : 8, region: A.get('blank'), capFirst: true, color: mat.darkMid }), null);
      tube(b, A, [0, 0.03, 0], [0, 0.2, 0.006], 0.013, 0.011, mat.metal, hi ? 8 : 5, { gloss: 0.5 });
      if (hi) for (const s of [-1, 1]) tube(b, A, [s * 0.036, 0.03, 0], [0, 0.14, 0.004], 0.005, 0.004, mat.dark, 5);
      const R = 0.168, seg = hi ? 28 : 14;
      // Schuesselachse nach vorn oben geneigt / dish axis tilted forward and up
      b.group({ p: [0, 0.236, 0.03], r: [HALF_PI - 0.5, 0, 0] }, () => {
        const bowl: Ring[] = [{ y: -0.046, rx: TIP }, { y: -0.04, rx: R * 0.3 }, { y: -0.022, rx: R * 0.72 }, { y: 0, rx: R, hard: true }];
        b.add(flipped(loft(bowl, { seg, region: A.get('dish'), color: mat.white })), null, { crease: 0.6 });
        b.add(loft([{ y: 0.006, rx: R - 0.008, hard: true }, { y: 0.006, rx: R + 0.004, hard: true }, { y: -0.006, rx: R + 0.004, hard: true }, { y: -0.03, rx: R * 0.72 }, { y: -0.05, rx: R * 0.3 }, { y: -0.056, rx: TIP }], { seg, region: A.get('blank'), color: shade(mat.white, 0.84) }), null, { crease: 0.5 });
        // Speisehorn auf drei Streben / feed horn on three struts
        tube(b, A, [0, -0.044, 0], [0, 0.11, 0], 0.005, 0.004, mat.dark, 5);
        b.add(loft([{ y: 0.016, rx: TIP }, { y: 0.008, rx: 0.014 }, { y: -0.008, rx: 0.014 }, { y: -0.016, rx: TIP }], { seg: hi ? 8 : 5, region: A.get('blank'), color: L.primary }), null, { xf: { p: [0, 0.118, 0] }, crease: 0 });
        if (hi) for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; tube(b, A, [Math.cos(a) * R * 0.94, -0.002, Math.sin(a) * R * 0.94], [0, 0.11, 0], 0.0026, 0.0026, mat.dark, 4); }
      });
    });
  });
  return b;
}

// ---------- Steppenkoloss / Steppe Colossus ----------

function colossusRings(L: Look, y: number): Ring[] {
  return [
    { y: y + 0.118, rx: 0.1, rz: 0.076, rzB: 0.094, e: 2.5, hard: true, c: L.hull },
    { y: y + 0.108, rx: 0.12, rz: 0.098, rzB: 0.11, e: 2.6 },
    { y: y + 0.078, rx: 0.146, rz: 0.128, rzB: 0.136, e: 2.7 },
    { y: y + 0.04, rx: 0.156, rz: 0.138, rzB: 0.146, e: 2.8 },
    { y: y + 0.018, rx: 0.153, rz: 0.134, rzB: 0.142, e: 2.8, hard: true },
    { y: y + 0.017, rx: 0.143, rz: 0.126, rzB: 0.132, e: 2.6, hard: true, c: L.trim },
    { y: y - 0.001, rx: 0.143, rz: 0.126, rzB: 0.132, e: 2.6 },
  ];
}

/** Kleiner MG-Turm auf dem Wannendach / small MG turret on the hull roof */
function mgTurret(b: UvBuilder, A: AtlasLayout, L: Look, p: V3, yaw: number): void {
  const hi = fine();
  b.group({ p, r: [0, yaw, 0] }, () => {
    b.add(loft([{ y: 0.044, rx: 0.026, hard: true }, { y: 0.036, rx: 0.04 }, { y: 0.012, rx: 0.047 }, { y: 0, rx: 0.049, hard: true }], { seg: hi ? 16 : 9, region: A.get('blank'), capFirst: A.get('hatch'), color: L.hull }), null);
    b.add(loft([{ y: 0.006, rx: 0.052, hard: true }, { y: 0, rx: 0.054 }], { seg: hi ? 16 : 9, region: A.get('blank'), color: L.trim }), null, { xf: { p: [0, -0.004, 0] } });
    machineGun(b, A, [0, 0.022, 0.04], { k: 0.95, len: 0.075 });
  });
}

/** Steppenkoloss; A = Panzeratlas (Zellen des Korvat-Panzers) / Steppe Colossus; A = tank atlas (the Korvat tank's cells) */
export function steppeColossus(f: FactionId, A: AtlasLayout): UvBuilder {
  const b = new UvBuilder(A.get('blank'));
  const L = look(f), hi = fine();
  const H: HullSpec = { y0: 0.108, y1: 0.128, y2: 0.2, xb: 0.228, xd: 0.186, zf: 0.262, zr: -0.3, zdf: 0.19, zdr: -0.246 };
  const T: TrackSpec = { x: 0.162, w: 0.1, len: 0.55, h: 0.108, links: 54, thick: 0.012 };
  tankHull(b, A, L, f, H, T, { emblemZ: -0.2, emblem: 0.046 });
  b.group({ p: [0, 0, (H.zf + H.zr) / 2] }, () => tankGear(b, A, T, 7, L.hullDark, L.trim, shade(L.hullDark, 0.5)));
  hullFittings(b, A, L, H);
  // Staukaesten auf den Flanken, Faesser am Heck, Traeger / stowage bins on the flanks, drums at the rear, rail
  b.mirrorX(() => b.add(projectBox(softBox(0.05, 0.03, 0.2, 0.006), { py: A.get('crate'), all: A.get('blank') }), L.trim, { xf: { p: [(H.xb + H.xd) / 2 + 0.012, (H.y1 + H.y2) / 2 + 0.016, 0.02], r: [0, 0, -1.04] } }));
  for (const s of [-1, 1]) fuelDrum(b, A, [s * 0.074, H.y2 + 0.014, H.zdr - 0.03], 0.036, 0.118, L.trim);
  b.add(block(0.32, 0.01, 0.014, 0.003), mat.dark, { xf: { p: [0, H.y2 - 0.012, H.zdr - 0.04] } });
  // kleine MG-Tuerme vorn links und hinten rechts / small MG turrets front left and rear right
  mgTurret(b, A, L, [-0.11, H.y2, H.zdf - 0.06], 0.25);
  mgTurret(b, A, L, [0.11, H.y2, H.zdr + 0.05], Math.PI - 0.5);
  // ---- grosser Gussturm mit EINEM Langrohr / big cast turret with ONE long gun ----
  const ty = H.y2, tz = ringZ(H);
  b.turret([0, ty, tz], () => {
    b.group({ p: [0, 0, tz] }, () => {
      const rings = colossusRings(L, ty);
      b.add(loft(rings, { seg: hi ? 32 : 16, region: A.get('turret'), capFirst: A.get('turretTop') }), null);
      for (const s of [-1, 1]) {
        const e = loftAt(rings, 0.5 + s * 0.31, ty + 0.056);
        emblemDecal(b, A, f, [e.p.x, e.p.y, e.p.z], [e.n.x, e.n.y, e.n.z], 0.05, L.hull);
        if (hi) [7, 0, 1].forEach((n, i) => { const q = loftAt(rings, 0.5 + s * (0.215 - i * 0.027), ty + 0.054); digitDecal(b, A, n, [q.p.x, q.p.y, q.p.z], [q.n.x, q.n.y, q.n.z], 0.03, L.hull); });
      }
      b.add(projectBox(softBox(0.15, 0.078, 0.06, 0.02, hi ? 1 : 0), { pz: A.get('mantlet'), all: A.get('blank') }), L.hullDark, { xf: { p: [0, ty + 0.056, 0.136] } });
      barrel(b, A, { x: 0, y: ty + 0.058, z0: 0.16, len: 0.448 - tz - 0.16 - 0.016, r: 0.0255, color: L.hullDark });
      // Staukorb und Plane am Turmheck / stowage basket and tarp at the turret rear
      b.add(projectBox(softBox(0.2, 0.044, 0.046, 0.007), { nz: A.get('crate'), all: A.get('blank') }), L.trim, { xf: { p: [0, ty + 0.044, -0.16] } });
      if (hi) b.add(loft([{ y: 0.08, rx: TIP }, { y: 0.074, rx: 0.015 }, { y: 0.04, rx: 0.019 }, { y: -0.04, rx: 0.018 }, { y: -0.074, rx: 0.015 }, { y: -0.08, rx: TIP }], { seg: 12, region: A.get('tarp'), color: L.gear }), null, { xf: { p: [0, ty + 0.084, -0.16], r: [0, 0, HALF_PI] }, crease: 0 });
      const top = ty + 0.118;
      // Kuppel links, Dach-MG rechts: dort, wo die Dachzelle sie zeichnet / cupola left, roof MG right: where the roof cell draws them
      cupola(b, A, f, [-0.587 * 0.1, top, -0.13 * 0.094], L.hullDark, L.hull, { seed: 7 });
      tube(b, A, [0.065, top - 0.002, 0], [0.065, top + 0.028, 0], 0.01, 0.007, mat.dark, 6);
      machineGun(b, A, [0.065, top + 0.04, 0.006], { shield: L.trim, box: hi ? L.gear : undefined, len: 0.09 });
      // Antenne / antenna
      b.add(loft([{ y: 0.012, rx: 0.005, hard: true }, { y: 0, rx: 0.007 }], { seg: hi ? 8 : 5, region: A.get('blank'), capFirst: true, color: mat.dark }), null, { xf: { p: [0.084, ty + 0.106, -0.094] } });
      tube(b, A, [0.084, ty + 0.116, -0.094], [0.084, ty + 0.3, -0.12], 0.0026, 0.0014, mat.dark, hi ? 5 : 3);
      b.add(loft([{ y: 0.008, rx: TIP }, { y: 0, rx: 0.0065 }, { y: -0.008, rx: TIP }], { seg: hi ? 6 : 4, region: A.get('blank'), color: mix(L.trim, mat.white, 0.2) }), null, { xf: { p: [0.084, ty + 0.302, -0.12] }, crease: 0 });
    });
  });
  return b;
}
