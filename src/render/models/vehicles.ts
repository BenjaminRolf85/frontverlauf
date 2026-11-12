/**
 * Fahrzeuge: Jeep, Panzer, Artillerie, Kampfhubschrauber / vehicles: jeep, tank, artillery, combat helicopter.
 * Gemeinsame Grundform je Typ + Fraktions-Anbauteile / shared base shape per type + faction add-ons.
 * Korvat kantig/Serie, Dravon scharfkantig + uebergrosse Geschuetze, Alvenia abgerundet,
 * Meridon leicht + Container-Optik, Velkar kompakt + gepanzert + Hightech.
 */
import type { FactionId } from '../../data/balance';
import { addEmblem } from './emblems';
import { Builder, geo, mix, rng, shade, type ColorLike } from './kit';
import { look, mat, type Look } from './look';
import { seatPose, soldier, standPose } from './soldiers';

const HALF_PI = Math.PI / 2;

interface WheelOpts { seg?: number; rim?: ColorLike; spokes?: number; lite?: boolean }
/** Rad mit Reifen, Felge, Nabe und optional Speichen / wheel with tyre, rim, hub and optional spokes */
function wheel(b: Builder, x: number, y: number, z: number, r: number, w: number, o: WheelOpts = {}) {
  const seg = o.lite ? 8 : (o.seg ?? 10);
  b.cyl(r, r, w, seg, mat.dark, [x, y, z], [0, 0, HALF_PI]);
  if (o.lite) {
    b.cyl(r * 0.5, r * 0.5, w + 0.006, 6, o.rim ?? mat.metal, [x, y, z], [0, 0, HALF_PI]);
    return;
  }
  if (!o.spokes) {
    // Profilring + Felge + Nabe / tread ring + rim + hub
    b.cyl(r * 0.6, r * 0.6, w + 0.008, 8, o.rim ?? mat.metal, [x, y, z], [0, 0, HALF_PI]);
    b.cyl(r * 0.22, r * 0.26, w + 0.018, 6, mat.metal, [x, y, z], [0, 0, HALF_PI]);
  } else {
    // Speichenrad / spoked wheel
    b.cyl(r * 0.8, r * 0.8, w + 0.002, seg, o.rim ?? mat.metal, [x, y, z], [0, 0, HALF_PI]);
    b.cyl(r * 0.68, r * 0.68, w + 0.004, seg, mat.dark, [x, y, z], [0, 0, HALF_PI]);
    for (let i = 0; i < o.spokes; i++) {
      const a = (i / o.spokes) * Math.PI;
      b.box(w * 0.5, r * 1.36, r * 0.12, o.rim ?? mat.metal, [x, y, z], [a, 0, 0]);
    }
    b.cyl(r * 0.24, r * 0.28, w + 0.02, 8, mat.metal, [x, y, z], [0, 0, HALF_PI]);
  }
}

/** Emblem auf beiden Seiten (Blick +-x) / emblem on both sides (facing +-x) */
function emblemSides(b: Builder, f: FactionId, L: Look, x: number, y: number, z: number, size: number) {
  if (size <= 0) return;
  addEmblem(b, f, size, 0.006, L.emblem, { p: [x, y, z], r: [0, HALF_PI, 0] });
  addEmblem(b, f, size, 0.006, L.emblem, { p: [-x, y, z], r: [0, -HALF_PI, 0] });
}

/** Schneetarn-Flecken auf einer Flaeche / snow camo patches */
function snowPatches(b: Builder, seed: number, n: number, area: { x: number; y0: number; y1: number; z0: number; z1: number }) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const y = area.y0 + R() * (area.y1 - area.y0);
    const z = area.z0 + R() * (area.z1 - area.z0);
    b.box(0.008, 0.02 + R() * 0.02, 0.03 + R() * 0.04, mat.snow, [side * area.x, y, z]);
  }
}

// ---------- Jeep ----------

export function jeep(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const light = f === 'meridon';
  const wr = light ? 0.06 : f === 'velkar' ? 0.05 : 0.055;
  const wy = wr;
  const gunScale = f === 'dravon' ? 1.7 : 1;
  // Raeder / wheels
  for (const x of [-0.118, 0.118]) for (const z of [-0.12, 0.13]) wheel(b, x, wy, z, wr, 0.045, { rim: L.trim, lite });
  // Fahrgestell / chassis
  const cy = wy + 0.01;
  b.box(0.2, 0.04, 0.36, L.hullDark, [0, cy, 0]);
  const by = cy + 0.02; // Karosserie-Unterkante / body bottom
  switch (f) {
    case 'korvat':
      // kantige Wanne, flache Haube / boxy tub, flat hood
      b.block(0, by, -0.06, 0.25, 0.075, 0.22, L.hull);
      b.block(0, by, 0.12, 0.22, 0.065, 0.14, L.hull);
      b.block(0, by + 0.065, 0.12, 0.2, 0.008, 0.12, shade(L.hull, 0.85));
      for (const x of [-0.13, 0.13]) for (const z of [-0.12, 0.13]) b.block(x, by + 0.03, z, 0.05, 0.012, 0.12, L.hullDark);
      for (const z of [-0.1, -0.02, 0.06]) b.block(0.127, by + 0.02, z, 0.008, 0.035, 0.01, L.trim);
      break;
    case 'dravon':
      // scharfkantige Keilform / sharp wedge
      b.add(geo.profileZY([[-0.18, 0], [0.2, 0], [0.21, 0.035], [0.06, 0.08], [-0.17, 0.085], [-0.19, 0.05]], 0.25), L.hull, { p: [0, by, 0] });
      b.add(geo.profileZY([[0.0, 0], [0.18, 0], [0.06, 0.03]], 0.255), L.trim, { p: [0, by + 0.045, 0] });
      for (const x of [-0.135, 0.135]) for (const z of [-0.12, 0.13]) b.add(geo.taper(0.03, 0.12, 0.02, 0.06, 0.03), L.hullDark, { p: [x, by + 0.04, z] });
      break;
    case 'alvenia': {
      // abgerundete Karosserie / rounded body
      b.add(geo.profileZY([[-0.18, 0], [0.2, 0], [0.21, 0.03], [0.19, 0.055], [0.12, 0.068], [-0.15, 0.075], [-0.18, 0.06]], 0.24), L.hull, { p: [0, by, 0] });
      for (const x of [-0.12, 0.12]) for (const z of [-0.12, 0.13]) b.cyl(0.07, 0.07, 0.03, 8, L.hull, [x, by + 0.005, z], [0, 0, HALF_PI]);
      b.block(0, by + 0.068, 0.08, 0.06, 0.006, 0.2, L.trim);
      break;
    }
    case 'meridon':
      // leicht mit Rohrrahmen und Container-Kasten / light with tube frame and container box
      b.block(0, by, 0.05, 0.2, 0.05, 0.3, L.hull);
      b.block(0, by, -0.13, 0.22, 0.08, 0.12, L.trim);
      for (const z of [-0.17, -0.14, -0.11, -0.08]) b.block(0, by + 0.005, z, 0.228, 0.07, 0.008, shade(L.trim, 0.8));
      for (const s of [-1, 1]) {
        b.tube([s * 0.1, by + 0.05, 0.03], [s * 0.1, by + 0.15, -0.0], 0.007, 4, mat.metal);
        b.tube([s * 0.1, by + 0.15, -0.0], [s * 0.1, by + 0.15, -0.06], 0.007, 4, mat.metal);
      }
      b.tube([-0.1, by + 0.15, -0.0], [0.1, by + 0.15, -0.0], 0.007, 4, mat.metal);
      break;
    case 'velkar':
      // kompakt, schraege Panzerplatten, Seitenschuerzen / compact, sloped armour, side skirts
      b.add(geo.profileZY([[-0.18, 0], [0.19, 0], [0.2, 0.04], [0.1, 0.09], [-0.16, 0.095], [-0.19, 0.06]], 0.24), L.hull, { p: [0, by, 0] });
      for (const s of [-1, 1]) b.block(s * 0.137, by - 0.03, 0.005, 0.016, 0.06, 0.36, L.hullDark);
      b.block(0.08, by + 0.09, -0.12, 0.04, 0.03, 0.04, L.hullDark);
      b.tube([0.08, by + 0.12, -0.12], [0.09, by + 0.25, -0.14], 0.004, 4, mat.dark);
      b.add(geo.ico(0.012, 0), L.secondary, { p: [0.09, by + 0.255, -0.14] });
      snowPatches(b, 5, 6, { x: 0.122, y0: by + 0.01, y1: by + 0.07, z0: -0.15, z1: 0.15 });
      b.block(0, by + 0.087, 0.04, 0.2, 0.01, 0.025, L.secondary);
      break;
  }
  // Windschutzscheibe mit Rahmen / windshield with frame
  const wsY = by + 0.07;
  b.group({ p: [0, wsY + 0.035, 0.05], r: [-0.25, 0, 0] }, () => {
    b.box(0.19, 0.05, 0.008, mat.glass, [0, 0, 0]);
    for (const s of [-1, 1]) b.box(0.014, 0.075, 0.014, L.hullDark, [s * 0.103, 0, 0]);
    b.box(0.22, 0.012, 0.014, L.hullDark, [0, 0.032, 0]);
    b.box(0.22, 0.012, 0.014, L.hullDark, [0, -0.032, 0]);
  });
  if (!lite) {
    // Scheinwerfer, Stossstange, Sitze, Lenkrad / headlights, bumper, seats, steering wheel
    const front = f === 'dravon' ? 0.2 : 0.19;
    const ly = by + (f === 'meridon' ? 0.035 : 0.045);
    for (const s of [-1, 1]) {
      b.cyl(0.018, 0.02, 0.016, 8, L.hullDark, [s * 0.075, ly, front + 0.004], [HALF_PI, 0, 0]);
      b.box(0.022, 0.022, 0.006, mat.yellow, [s * 0.075, ly, front + 0.013]);
    }
    b.box(0.24, 0.022, 0.024, mat.dark, [0, cy, 0.195]);
    b.box(0.22, 0.022, 0.024, mat.dark, [0, cy, -0.195]);
    for (const x of [-0.055, 0.055]) {
      b.add(geo.cbox(0.06, 0.02, 0.055, 0.008), mat.darkMid, { p: [x, by + 0.07, -0.0] });
    }
    b.add(geo.cyl(0.024, 0.024, 0.006, 8, true), mat.ink, { p: [-0.055, by + 0.115, 0.03], r: [1.1, 0, 0] });
    // Ersatzrad hinten in Fraktionsfarbe / spare wheel at the rear with faction rim
    b.group({ p: [0, by + 0.07, -0.205], r: [0, HALF_PI, 0] }, () => wheel(b, 0, 0, 0, 0.048, 0.03, { rim: L.trim }));
    // Kanister / jerrycan
    b.box(0.03, 0.05, 0.04, L.primaryDark, [0.105, by + 0.1, -0.18]);
  }
  // Emblem auf der Haube / emblem on hood
  addEmblem(b, f, 0.04, 0.006, L.emblem, { p: [0, by + (f === 'velkar' ? 0.075 : f === 'korvat' ? 0.073 : 0.07), 0.13], r: [-HALF_PI + (f === 'dravon' ? 0.3 : 0.1), 0, 0] });
  // Bordwaffe auf Lafette / mounted gun on a pintle
  const gy = by + 0.2;
  b.cyl(0.012, 0.016, 0.13, 6, mat.dark, [0.05, by + 0.13, -0.09]);
  b.group({ p: [0.05, gy, -0.09] }, () => {
    b.add(geo.cbox(0.04 * gunScale, 0.04 * gunScale, 0.1, 0.008), mat.dark, { p: [0, 0, 0.02] });
    b.cyl(0.011 * gunScale, 0.011 * gunScale, 0.17 * gunScale, 8, mat.metal, [0, 0.005, 0.07 + 0.085 * gunScale], [HALF_PI, 0, 0]);
    b.cyl(0.016 * gunScale, 0.014 * gunScale, 0.03, 8, mat.dark, [0, 0.005, 0.07 + 0.17 * gunScale], [HALF_PI, 0, 0]);
    b.add(geo.cbox(0.03, 0.035, 0.04, 0.006), L.gear, { p: [0.035, -0.015, 0.0] });
    // Schutzschild in Zweitfarbe / gun shield in secondary colour
    b.add(geo.ctaper(0.11, 0.01, 0.09, 0.01, 0.065, 0.004), L.trim, { p: [0, 0.012, 0.075], r: [-0.12, 0, 0] });
    for (const s of [-1, 1]) b.box(0.008, 0.03, 0.03, mat.dark, [s * 0.015, -0.03, -0.05], [0.3, 0, 0]);
  });
  if (!lite) {
    // Fahrer, Kuehlergrill, Spiegel, Abschlepphaken / driver, grille, mirrors, tow hook
    b.group({ p: [-0.055, by - 0.005, 0.0], s: 0.85 }, () => soldier(b, f, seatPose([[-0.045, 0.125, 0.11], [0.045, 0.125, 0.11]]), { detail: 0, seed: 3, noLegs: true }));
    for (let i = 0; i < 5; i++) b.box(0.008, 0.03, 0.006, mat.ink, [-0.04 + i * 0.02, by + 0.03, 0.2]);
    for (const sx of [-1, 1]) {
      b.box(0.004, 0.004, 0.03, mat.dark, [sx * 0.12, by + 0.11, 0.05], [0, sx * 0.4, 0]);
      b.box(0.012, 0.02, 0.006, mat.glass, [sx * 0.134, by + 0.115, 0.06]);
      b.box(0.004, 0.05, 0.004, mat.ink, [sx * 0.12, by + 0.035, 0.03]);
    }
    b.add(geo.torus(0.01, 0.003, 3, 8), mat.dark, { p: [0, cy, -0.212], r: [0, HALF_PI, 0] });
  }
  // Schuetze / gunner
  if (!lite) b.group({ p: [0.05, by - 0.035, -0.17], s: 0.78 }, () => soldier(b, f, standPose([[-0.035, 0.29, 0.075], [0.035, 0.29, 0.075]]), { detail: 0, seed: 4, noLegs: true }));
  return b;
}

// ---------- Panzer / tank ----------

export function tank(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const light = f === 'meridon';
  const tw = light ? 0.07 : 0.08; // Kettenbreite / track width
  const tx = light ? 0.12 : 0.125;
  // Ketten mit Laufrollen / tracks with road wheels
  const trackProfile: [number, number][] = [[-0.2, 0.025], [-0.17, 0], [0.17, 0], [0.205, 0.03], [0.2, 0.065], [0.18, 0.085], [-0.18, 0.085], [-0.205, 0.06]];
  for (const s of [-1, 1]) {
    b.add(geo.profileZY(trackProfile, tw), mat.dark, { p: [s * tx, 0, 0] });
    const ox = s * (tx + tw / 2 + 0.004);
    if (lite) {
      for (const z of [-0.13, -0.045, 0.045, 0.13]) b.cyl(0.032, 0.032, 0.012, 8, mat.metal, [ox, 0.04, z], [0, 0, HALF_PI]);
      continue;
    }
    // Laufrollen, Treib- und Leitrad, Kettenglieder / road wheels, sprocket, idler, track links
    for (const z of [-0.13, -0.065, 0.0, 0.065, 0.13]) {
      b.cyl(0.03, 0.03, 0.012, 10, mat.metal, [ox, 0.035, z], [0, 0, HALF_PI]);
      b.cyl(0.013, 0.013, 0.018, 6, L.hullDark, [ox, 0.035, z], [0, 0, HALF_PI]);
    }
    // Stuetzrollen / return rollers
    for (const z of [-0.08, 0.0, 0.08]) b.cyl(0.011, 0.011, 0.012, 6, mat.metal, [ox, 0.075, z], [0, 0, HALF_PI]);
    b.cyl(0.026, 0.026, 0.014, 10, L.trim, [ox, 0.058, 0.18], [0, 0, HALF_PI]);
    for (let i = 0; i < 6; i++) b.box(0.008, 0.012, 0.008, mat.ink, [ox + s * 0.004, 0.058 + Math.cos((i / 6) * Math.PI * 2) * 0.028, 0.18 + Math.sin((i / 6) * Math.PI * 2) * 0.028]);
    b.cyl(0.024, 0.024, 0.014, 10, mat.metal, [ox, 0.055, -0.185], [0, 0, HALF_PI]);
    for (let i = 0; i < 9; i++) b.box(tw + 0.006, 0.008, 0.012, mat.ink, [s * tx, 0.088, -0.16 + i * 0.04]);
  }
  // Wanne / hull
  const hullW = 2 * tx - tw + 0.01;
  b.add(geo.profileZY([[-0.19, 0.04], [0.15, 0.04], [0.21, 0.09], [0.17, 0.145], [-0.18, 0.145], [-0.2, 0.11]], hullW), L.hull, {});
  b.block(0, 0.085, 0, 2 * tx + tw + 0.01, 0.014, 0.4, f === 'velkar' ? L.hullDark : L.hull);
  if (!lite) {
    // Bugplatte, Scheinwerfer, Motorgitter, Auspuff, Werkzeugkiste / glacis, lights, engine grille, exhaust, toolbox
    b.box(hullW - 0.02, 0.012, 0.07, L.hullDark, [0, 0.118, 0.18], [0.68, 0, 0]);
    for (const sx of [-1, 1]) {
      b.box(0.024, 0.018, 0.014, mat.dark, [sx * 0.08, 0.13, 0.172], [0.68, 0, 0]);
      b.box(0.018, 0.012, 0.004, mat.yellow, [sx * 0.08, 0.134, 0.18], [0.68, 0, 0]);
    }
    for (let i = 0; i < 3; i++) b.box(hullW * 0.6, 0.006, 0.01, mat.ink, [0, 0.148, -0.11 - i * 0.022]);
    b.box(0.05, 0.03, 0.08, L.primaryDark, [-(tx + tw / 2 - 0.03), 0.107, -0.1]);
    b.box(0.05, 0.03, 0.08, L.secondary, [tx + tw / 2 - 0.03, 0.107, -0.1]);
    // Seitenschuerzen-Kante + Abschlepphaken / skirt edge + tow hooks
    for (const sx of [-1, 1]) {
      b.box(0.006, 0.012, 0.36, L.trim, [sx * (tx + tw / 2 + 0.004), 0.095, 0]);
      b.add(geo.torus(0.009, 0.003, 3, 8), mat.dark, { p: [sx * 0.07, 0.07, 0.21], r: [0, HALF_PI, 0] });
    }
  }
  const ty = 0.145; // Turmboden / turret base
  let tz = -0.03;
  let barrelLen = 0.27;
  let barrelR = 0.016;
  let mantletZ = 0.1;
  switch (f) {
    case 'korvat':
      // kantiger Turm, Serienoptik mit Ersatzkettengliedern / boxy turret with spare track links
      b.add(geo.taper(0.21, 0.21, 0.17, 0.17, 0.08), L.hull, { p: [0, ty + 0.04, tz] });
      for (const z of [-0.14, -0.1, -0.06, -0.02, 0.02, 0.06]) b.block(0, 0.12, z, 2 * tx + 0.07, 0.02, 0.03, mat.dark);
      b.block(0, ty, tz - 0.12, 0.16, 0.05, 0.04, L.hullDark);
      mantletZ = tz + 0.1;
      emblemSides(b, f, L, 0.1, ty + 0.04, tz, lite ? 0 : 0.032);
      break;
    case 'dravon':
      // scharfkantiger Keilturm, uebergrosses Geschuetz / sharp wedge turret, oversized gun
      b.add(geo.prismXZ([[-0.12, -0.11], [0.12, -0.11], [0.13, 0.03], [0.05, 0.14], [-0.05, 0.14], [-0.13, 0.03]], 0.075), L.hull, { p: [0, ty, tz] });
      b.add(geo.prismXZ([[-0.09, -0.08], [0.09, -0.08], [0.1, 0.02], [0.03, 0.1], [-0.03, 0.1], [-0.1, 0.02]], 0.02), L.hullDark, { p: [0, ty + 0.075, tz] });
      b.add(geo.prismXZ([[-0.125, -0.11], [0.125, -0.11], [0.135, 0.03], [-0.135, 0.03]], 0.014), L.trim, { p: [0, ty + 0.03, tz] });
      b.add(geo.profileZY([[0.15, 0.04], [0.21, 0.09], [0.205, 0.1], [0.145, 0.05]], hullW + 0.01), L.trim, {});
      barrelLen = 0.33;
      barrelR = 0.024;
      mantletZ = tz + 0.14;
      emblemSides(b, f, L, 0.122, ty + 0.05, tz - 0.04, lite ? 0 : 0.03);
      break;
    case 'alvenia':
      // runder, moderner Turm / rounded, modern turret
      b.cyl(0.11, 0.115, 0.06, 10, L.hull, [0, ty + 0.03, tz]);
      b.add(geo.hemi(0.11, 10, 3), L.hull, { p: [0, ty + 0.06, tz], s: [1, 0.28, 1] });
      b.add(geo.cyl(0.116, 0.116, 0.014, 10, true), L.trim, { p: [0, ty + 0.035, tz] });
      b.add(geo.cbox(0.04, 0.03, 0.04, 0.008), mat.glassDark, { p: [0.05, ty + 0.085, tz - 0.01] });
      mantletZ = tz + 0.105;
      emblemSides(b, f, L, 0.112, ty + 0.03, tz, lite ? 0 : 0.028);
      break;
    case 'meridon':
      // leichter Turm mit Container-Staukaesten / light turret with container stowage boxes
      b.add(geo.taper(0.18, 0.18, 0.15, 0.15, 0.07), L.hull, { p: [0, ty + 0.035, tz + 0.01] });
      b.block(0, ty + 0.005, tz - 0.115, 0.17, 0.06, 0.06, L.trim);
      for (const x of [-0.06, -0.02, 0.02, 0.06]) b.block(x, ty + 0.005, tz - 0.115, 0.008, 0.062, 0.064, shade(L.trim, 0.78));
      for (const s of [-1, 1]) {
        b.block(s * 0.168, 0.1, -0.05, 0.03, 0.04, 0.16, L.trim);
        for (const z of [-0.1, -0.05, 0.0]) b.block(s * 0.168, 0.1, z, 0.034, 0.042, 0.008, shade(L.trim, 0.78));
      }
      barrelLen = 0.25;
      barrelR = 0.013;
      mantletZ = tz + 0.085;
      emblemSides(b, f, L, 0.088, ty + 0.035, tz + 0.02, lite ? 0 : 0.026);
      break;
    case 'velkar':
      // kompakter, flacher Turm mit Sensoren, Seitenschuerzen / compact low turret with sensors, side skirts
      b.add(geo.taper(0.2, 0.2, 0.13, 0.15, 0.065, -0.01), L.hull, { p: [0, ty + 0.0325, tz] });
      b.block(0, ty + 0.065, tz - 0.02, 0.1, 0.012, 0.1, L.hullDark);
      for (const s of [-1, 1]) b.block(s * (tx + tw / 2 + 0.012), 0.02, 0, 0.014, 0.075, 0.38, L.hullDark);
      b.block(0.06, ty + 0.065, tz - 0.04, 0.045, 0.03, 0.04, mat.dark);
      b.add(geo.taper(0.035, 0.012, 0.035, 0.012, 0.016), L.secondary, { p: [0.06, ty + 0.085, tz - 0.015] });
      b.tube([-0.06, ty + 0.06, tz - 0.08], [-0.07, ty + 0.22, -0.13], 0.004, 4, mat.dark);
      b.add(geo.ico(0.012, 0), L.secondary, { p: [-0.07, ty + 0.225, -0.13] });
      snowPatches(b, 9, 8, { x: tx + tw / 2 + 0.02, y0: 0.03, y1: 0.09, z0: -0.17, z1: 0.17 });
      snowPatches(b, 19, 4, { x: 0.092, y0: ty + 0.01, y1: ty + 0.05, z0: tz - 0.08, z1: tz + 0.06 });
      mantletZ = tz + 0.09;
      barrelLen = 0.25;
      barrelR = 0.018;
      emblemSides(b, f, L, tx + tw / 2 + 0.02, 0.06, 0.1, lite ? 0 : 0.022);
      break;
  }
  // Blende + Rohr + Muendungsbremse / mantlet + barrel + muzzle brake
  const by0 = ty + 0.035;
  b.add(geo.cbox(0.075, 0.052, 0.045, 0.012), L.hullDark, { p: [0, by0, mantletZ] });
  b.cyl(barrelR, barrelR * 1.1, barrelLen, 8, L.hullDark, [0, by0, mantletZ + barrelLen / 2], [HALF_PI, 0, 0]);
  if (!lite && f !== 'korvat') b.cyl(barrelR * 1.5, barrelR * 1.5, 0.045, 8, L.hullDark, [0, by0, mantletZ + barrelLen * 0.5], [HALF_PI, 0, 0]);
  if (f === 'dravon' || f === 'korvat') {
    b.add(geo.cbox(barrelR * 3.2, barrelR * 2.4, 0.05, 0.006), mat.dark, { p: [0, by0, mantletZ + barrelLen - 0.012] });
  } else {
    b.cyl(barrelR * 1.35, barrelR * 1.35, 0.028, lite ? 8 : 10, mat.dark, [0, by0, mantletZ + barrelLen - 0.012], [HALF_PI, 0, 0]);
  }
  if (!lite) {
    // Kommandantenkuppel mit offenem Luk, Antenne / commander cupola with open hatch, antenna
    const cx = -0.045, cz = tz - 0.03;
    const top = f === 'dravon' ? ty + 0.095 : f === 'velkar' ? ty + 0.077 : f === 'meridon' ? ty + 0.07 : ty + 0.08;
    b.cyl(0.036, 0.04, 0.026, 8, L.hullDark, [cx, top + 0.008, cz]);
    b.box(0.03, 0.01, 0.008, mat.glassDark, [cx, top + 0.014, cz + 0.038]);
    b.box(0.05, 0.008, 0.05, L.hull, [cx, top + 0.045, cz - 0.03], [-1.2, 0, 0]);
    if (f !== 'velkar') b.group({ p: [cx, top - 0.13, cz], s: 0.62 }, () => soldier(b, f, standPose([[-0.12, 0.25, 0.04], [0.12, 0.25, 0.04]]), { detail: 0, seed: 7, noLegs: true }));
    b.tube([0.06, top, tz - 0.1], [0.075, top + 0.2, tz - 0.13], 0.003, 4, mat.dark);
    b.add(geo.ico(0.008, 0), L.secondary, { p: [0.075, top + 0.205, tz - 0.13] });
    b.box(0.03, 0.02, 0.025, mat.dark, [0.06, top - 0.002, tz - 0.1]);
    // Nebelwerfer + Stauraum / smoke launchers + stowage
    const sw = f === 'meridon' ? 0.08 : f === 'alvenia' ? 0.1 : 0.095;
    for (const sx of [-1, 1]) {
      b.box(0.03, 0.012, 0.03, L.hullDark, [sx * sw, ty + 0.045, tz + 0.06]);
      for (let i = 0; i < 3; i++) b.cyl(0.007, 0.007, 0.026, 6, mat.dark, [sx * (sw - 0.01 + i * 0.01), ty + 0.058, tz + 0.068], [0.7, 0, sx * 0.3]);
    }
    b.add(geo.cbox(0.16, 0.022, 0.03, 0.006), L.hullDark, { p: [0, ty + 0.03, tz - 0.115] });
    b.cyl(0.012, 0.012, 0.13, 8, L.secondary, [0, ty + 0.055, tz - 0.115], [0, 0, HALF_PI]);
  }
  return b;
}

// ---------- Artillerie / artillery ----------

export function artillery(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const big = f === 'dravon' ? 1.15 : 1;
  const wr = f === 'meridon' ? 0.07 : 0.075;
  for (const s of [-1, 1]) wheel(b, s * 0.14, wr, 0.02, wr, 0.035, { spokes: lite ? 0 : 5, rim: L.hull, lite, seg: 12 });
  b.box(0.27, 0.02, 0.02, mat.dark, [0, wr, 0.02]);
  // Spreizlafette / split trail
  for (const s of [-1, 1]) {
    b.add(geo.box(0.03, 0.03, 0.315), L.hullDark, { p: [s * 0.1, 0.045, -0.17], r: [-0.28, -s * 0.32, 0] });
    b.box(0.06, 0.05, 0.012, mat.dark, [s * 0.15, 0.025, -0.325], [0, -s * 0.32, 0]);
  }
  // Wiege + Schild / cradle + shield
  b.block(0, wr, 0.0, 0.1, 0.06, 0.12, L.hull);
  switch (f) {
    case 'korvat':
      b.box(0.3, 0.13, 0.014, L.hull, [0, wr + 0.08, 0.075], [-0.2, 0, 0]);
      for (const x of [-0.11, 0, 0.11]) b.box(0.012, 0.012, 0.018, mat.dark, [x, wr + 0.12, 0.068], [-0.2, 0, 0]);
      break;
    case 'dravon':
      b.add(geo.profileXY([[-0.17, 0], [0.17, 0], [0.15, 0.1], [0.04, 0.16], [-0.04, 0.16], [-0.15, 0.1]], 0.016), L.hull, { p: [0, wr + 0.01, 0.075], r: [-0.25, 0, 0] });
      b.add(geo.profileXY([[-0.17, 0], [0.17, 0], [0.165, 0.025], [-0.165, 0.025]], 0.02), L.trim, { p: [0, wr + 0.01, 0.075], r: [-0.25, 0, 0] });
      break;
    case 'alvenia':
      b.add(geo.cyl(0.17, 0.17, 0.014, 12), L.hull, { p: [0, wr + 0.05, 0.075], r: [HALF_PI - 0.2, 0, 0], s: [1, 1, 0.55] });
      b.box(0.3, 0.014, 0.02, L.trim, [0, wr + 0.03, 0.075], [-0.2, 0, 0]);
      break;
    case 'meridon':
      b.box(0.24, 0.1, 0.012, L.hull, [0, wr + 0.07, 0.075], [-0.2, 0, 0]);
      b.block(0, 0.0, -0.08, 0.12, 0.06, 0.08, L.trim);
      for (const x of [-0.04, 0, 0.04]) b.block(x, 0.002, -0.08, 0.008, 0.062, 0.084, shade(L.trim, 0.78));
      break;
    case 'velkar':
      b.add(geo.taper(0.3, 0.03, 0.24, 0.02, 0.12, -0.02), L.hull, { p: [0, wr + 0.07, 0.075] });
      b.block(0.08, wr + 0.13, 0.04, 0.04, 0.025, 0.03, mat.dark);
      b.box(0.03, 0.01, 0.006, L.secondary, [0.08, wr + 0.145, 0.058]);
      snowPatches(b, 3, 4, { x: 0.051, y0: wr + 0.01, y1: wr + 0.05, z0: -0.04, z1: 0.04 });
      break;
  }
  // langes Rohr, angehoben / long barrel, raised
  b.group({ p: [0, wr + 0.06, 0.02], r: [-0.3, 0, 0] }, () => {
    b.add(lite ? geo.box(0.06, 0.05, 0.14) : geo.cbox(0.06, 0.05, 0.14, 0.012), L.hullDark, { p: [0, 0, 0.0] });
    if (!lite) {
      // Rohrruecklauf-Zylinder + Verschluss / recoil cylinders + breech
      b.cyl(0.013, 0.013, 0.16, 10, L.hull, [0, 0.032, 0.07], [HALF_PI, 0, 0]);
      b.add(geo.cbox(0.05, 0.05, 0.04, 0.01), mat.dark, { p: [0, 0, -0.085] });
      b.box(0.008, 0.03, 0.03, mat.metal, [0.03, 0.0, -0.085]);
    }
    b.cyl(0.017 * big, 0.019 * big, 0.32 * big, 8, L.hullDark, [0, 0.0, 0.07 + 0.16 * big], [HALF_PI, 0, 0]);
    b.cyl(0.027 * big, 0.027 * big, 0.04, 8, mat.dark, [0, 0.0, 0.07 + 0.32 * big - 0.02], [HALF_PI, 0, 0]);
  });
  addEmblem(b, f, 0.035, 0.006, L.emblem, { p: [-0.09, wr + 0.09, 0.09], r: [-0.2, 0, 0] });
  // Bedienung / crew
  if (!lite) {
    b.group({ p: [0.22, 0, -0.12], r: [0, -0.5, 0] }, () => soldier(b, f, standPose([[-0.035, 0.17, 0.1], [0.035, 0.17, 0.1]]), { detail: 1, seed: 13 }));
    // Ladeschuetze mit Granate / loader carrying a shell
    b.group({ p: [-0.22, 0, -0.2], r: [0, 0.7, 0] }, () => {
      soldier(b, f, standPose([[-0.04, 0.17, 0.1], [0.04, 0.19, 0.1]]), { detail: 0, seed: 17 });
      b.cyl(0.016, 0.016, 0.08, 8, mat.gold, [0, 0.18, 0.11], [0, 0, HALF_PI]);
      b.add(geo.cone(0.016, 0.03, 8), mat.dark, { p: [0.055, 0.18, 0.11], r: [0, 0, -HALF_PI] });
    });
    // Munitionskiste mit Granaten / ammo crate with shells
    b.add(geo.cbox(0.09, 0.04, 0.06, 0.01), mat.wood, { p: [-0.26, 0.02, 0.06] });
    for (const x of [-0.285, -0.26, -0.235]) b.cyl(0.01, 0.01, 0.05, 6, mat.gold, [x, 0.06, 0.06]);
  }
  b.box(0.06, 0.04, 0.04, L.gear, [0.25, 0.02, 0.03]);
  return b;
}

// ---------- Kampfhubschrauber / combat helicopter ----------

export function heli(f: FactionId, lite = false): Builder {
  const b = new Builder();
  const L = look(f);
  const lift = 0.08; // schwebt / hovering
  const by = lift + 0.05;
  // Kufen mit Querrohren / skids with cross tubes
  for (const s of [-1, 1]) {
    b.cyl(0.008, 0.008, 0.3, 4, mat.dark, [s * 0.085, lift, 0.02], [HALF_PI, 0, 0]);
    b.tube([s * 0.085, lift, 0.17], [s * 0.085, lift + 0.02, 0.195], 0.008, lite ? 4 : 6, mat.dark);
    b.tube([s * 0.085, lift, 0.1], [s * 0.05, by + 0.02, 0.09], 0.006, lite ? 4 : 6, mat.dark);
    b.tube([s * 0.085, lift, -0.06], [s * 0.05, by + 0.02, -0.06], 0.006, lite ? 4 : 6, mat.dark);
  }
  let topY = by + 0.11;
  // Rumpf / fuselage
  switch (f) {
    case 'korvat':
      b.add(geo.rtaper(0.13, 0.28, 0.11, 0.22, 0.11, 0.016, -0.01), L.hull, { p: [0, by + 0.055, 0.0] });
      b.add(geo.rtaper(0.12, 0.08, 0.09, 0.04, 0.07, 0.01, -0.015), mat.glass, { p: [0, by + 0.075, 0.16] });
      b.block(0, by + 0.04, 0.0, 0.135, 0.014, 0.25, L.trim);
      break;
    case 'dravon':
      b.add(geo.profileZY([[-0.12, 0.02], [0.12, 0], [0.22, 0.04], [0.16, 0.1], [0.04, 0.12], [-0.12, 0.11]], 0.13), L.hull, { p: [0, by, 0] });
      b.add(geo.profileZY([[0.06, 0.08], [0.14, 0.075], [0.18, 0.06], [0.16, 0.1], [0.05, 0.12]], 0.1), mat.glassDark, { p: [0, by + 0.001, 0] });
      b.add(geo.profileZY([[-0.12, 0.05], [0.18, 0.04], [0.19, 0.05], [-0.12, 0.065]], 0.134), L.trim, { p: [0, by, 0] });
      topY = by + 0.12;
      break;
    case 'alvenia':
      b.add(geo.sphere(0.1, 12, 6), L.hull, { p: [0, by + 0.06, 0.0], s: [0.7, 0.62, 1.35] });
      b.add(geo.sphere(0.07, 10, 5), mat.glass, { p: [0, by + 0.08, 0.1], s: [0.85, 0.75, 1.1] });
      b.box(0.02, 0.012, 0.2, L.trim, [0, by + 0.115, -0.02]);
      break;
    case 'meridon':
      b.add(geo.rtaper(0.1, 0.24, 0.085, 0.2, 0.095, 0.014, -0.01), L.hull, { p: [0, by + 0.05, 0.0] });
      b.add(geo.rtaper(0.09, 0.08, 0.07, 0.04, 0.065, 0.01, -0.015), mat.glass, { p: [0, by + 0.07, 0.15] });
      // Container-Kufenkasten / container pod
      b.block(0, by - 0.035, -0.02, 0.09, 0.04, 0.14, L.trim);
      for (const z of [-0.07, -0.035, 0, 0.035]) b.block(0, by - 0.036, z, 0.094, 0.042, 0.008, shade(L.trim, 0.78));
      topY = by + 0.095;
      break;
    case 'velkar':
      b.add(geo.profileZY([[-0.11, 0.0], [0.12, 0.0], [0.17, 0.05], [0.13, 0.1], [-0.1, 0.105], [-0.13, 0.06]], 0.14), L.hull, { p: [0, by, 0] });
      b.add(geo.profileZY([[0.08, 0.07], [0.15, 0.055], [0.12, 0.095], [0.06, 0.1]], 0.11), mix(L.secondary, mat.glassDark, 0.5), { p: [0, by + 0.002, 0] });
      b.add(geo.ico(0.03, 0), mat.dark, { p: [0, by + 0.015, 0.17] });
      b.box(0.02, 0.008, 0.02, L.secondary, [0, by + 0.01, 0.2]);
      snowPatches(b, 21, 6, { x: 0.071, y0: by + 0.02, y1: by + 0.09, z0: -0.09, z1: 0.08 });
      topY = by + 0.105;
      break;
  }
  // Heckausleger / tail boom
  const boomH = f === 'dravon' ? 0.045 : 0.038;
  const seg = lite ? 6 : 10;
  if (f === 'alvenia') b.add(geo.cyl(boomH * 0.55, boomH * 0.35, 0.25, seg), L.hull, { p: [0, by + 0.075, -0.235], r: [-HALF_PI, 0, 0] });
  else b.add(lite ? geo.taper(boomH * 0.6, boomH * 0.6, boomH, boomH, 0.24) : geo.ctaper(boomH * 0.6, boomH * 0.6, boomH, boomH, 0.24, 0.008), L.hull, { p: [0, by + 0.07, -0.24], r: [HALF_PI, 0, 0] });
  b.add(lite ? geo.taper(0.012, 0.06, 0.008, 0.04, 0.09, -0.02) : geo.rtaper(0.014, 0.065, 0.01, 0.04, 0.095, 0.004, -0.025), L.hull, { p: [0, by + 0.11, -0.35] });
  b.add(geo.taper(0.012, 0.022, 0.008, 0.02, 0.02), L.trim, { p: [0, by + 0.165, -0.375] });
  b.add(lite ? geo.box(0.12, 0.008, 0.035) : geo.cbox(0.13, 0.008, 0.035, 0.012), L.hull, { p: [0, by + 0.075, -0.32] });
  for (const s of [-1, 1]) b.box(0.006, 0.03, 0.03, L.trim, [s * 0.066, by + 0.075, -0.32]);
  // Heckrotor / tail rotor
  b.cyl(0.008, 0.008, 0.02, 6, mat.dark, [0.015, by + 0.11, -0.36], [0, 0, HALF_PI]);
  for (let i = 0; i < 2; i++) {
    b.group({ p: [0.024, by + 0.11, -0.36], r: [(i / 2) * Math.PI + 0.4, 0, 0] }, () => {
      b.box(0.004, 0.11, 0.014, mat.dark, [0, 0, 0]);
      if (!lite) b.box(0.005, 0.016, 0.015, L.trim, [0, 0.05, 0]);
    });
  }
  b.box(0.018, 0.02, 0.06, L.trim, [0, by + 0.08, -0.25]);
  if (!lite) {
    // Triebwerk mit Auspuff, Kabinenrahmen, Seitenfenster, Pilot / engine with exhausts, canopy frame, side windows, pilot
    const ey = topY - 0.012;
    b.add(geo.ctaper(0.09, 0.15, 0.07, 0.12, 0.035, 0.014), L.hullDark, { p: [0, ey + 0.017, -0.03] });
    for (const sx of [-1, 1]) {
      b.cyl(0.014, 0.012, 0.04, 8, mat.darkMid, [sx * 0.05, ey + 0.015, -0.1], [HALF_PI, 0, 0]);
      b.box(0.004, 0.03, 0.05, mat.glassDark, [sx * 0.066, by + 0.07, 0.05]);
    }
    b.box(0.03, 0.032, 0.032, mat.skin, [0, by + 0.095, 0.11]);
    b.add(geo.hemi(0.022, 8, 2), L.primary, { p: [0, by + 0.108, 0.108] });
    b.box(0.03, 0.008, 0.006, mat.glassDark, [0, by + 0.098, 0.127]);
    b.box(0.006, 0.006, 0.09, mat.dark, [0, by + 0.115, 0.12], [0.35, 0, 0]);
  }
  if (!lite) {
    // Kanzelstreben, Bugsensor, Stoersender, Antennen, Landescheinwerfer / canopy frame, nose sensor, IR jammer, antennas, landing light
    const cz = f === 'alvenia' ? 0.1 : f === 'dravon' || f === 'velkar' ? 0.11 : 0.15;
    for (const dz of [-0.03, 0.0, 0.03]) b.box(0.1, 0.006, 0.006, mat.dark, [0, by + 0.105 - Math.abs(dz) * 0.5, cz + dz]);
    b.box(0.006, 0.006, 0.08, mat.dark, [0, by + 0.11, cz]);
    b.add(geo.sphere(0.022, 10, 5), mat.dark, { p: [0, by + 0.02, 0.2] });
    b.cyl(0.012, 0.012, 0.006, 8, mat.glassDark, [0, by + 0.02, 0.222], [HALF_PI, 0, 0]);
    b.cyl(0.014, 0.016, 0.03, 8, mat.darkMid, [0, topY - 0.005, -0.13]);
    b.add(geo.hemi(0.014, 8, 2), mat.darkMid, { p: [0, topY + 0.01, -0.13] });
    b.box(0.004, 0.03, 0.02, mat.dark, [0, by + 0.012, -0.2], [0.3, 0, 0]);
    b.box(0.004, 0.025, 0.016, mat.dark, [0, by + 0.105, -0.28], [-0.3, 0, 0]);
    b.cyl(0.01, 0.01, 0.006, 8, mat.yellow, [0, by - 0.008, 0.06]);
    for (const sx of [-1, 1]) {
      b.add(geo.rbox(0.02, 0.03, 0.04, 0.006), shade(L.hull, 0.8), { p: [sx * 0.052, topY - 0.002, -0.1] });
      b.box(0.03, 0.004, 0.02, mat.dark, [sx * 0.085, lift + 0.03, 0.06]);
    }
  }
  // Stummelfluegel + Raketenbehaelter + Lenkflugkoerper / stub wings + rocket pods + missiles
  const podScale = f === 'dravon' ? 1.3 : 1;
  for (const s of [-1, 1]) {
    b.add(geo.box(0.12, 0.012, 0.052), L.hullDark, { p: [s * 0.11, by + 0.05, 0.0], r: [0, 0, s * -0.1] });
    b.cyl(0.024 * podScale, 0.024 * podScale, 0.1, lite ? 6 : 8, L.hullDark, [s * 0.155, by + 0.03, 0.01], [HALF_PI, 0, 0]);
    b.cyl(0.018 * podScale, 0.018 * podScale, 0.004, lite ? 6 : 8, mat.dark, [s * 0.155, by + 0.03, 0.062], [HALF_PI, 0, 0]);
    if (!lite) {
      b.add(geo.rbox(0.014, 0.024, 0.06, 0.005), L.hullDark, { p: [s * 0.13, by + 0.035, 0.0] });
      for (const dx of [-0.012, 0.012]) {
        b.cyl(0.008, 0.008, 0.08, 8, mat.white, [s * 0.11 + dx, by + 0.026, 0.015], [HALF_PI, 0, 0]);
        b.add(geo.cone(0.008, 0.02, 8), mat.red, { p: [s * 0.11 + dx, by + 0.026, 0.065], r: [HALF_PI, 0, 0] });
        b.box(0.024, 0.002, 0.012, mat.dark, [s * 0.11 + dx, by + 0.026, -0.02]);
      }
      b.box(0.01, 0.018, 0.006, L.hullDark, [s * 0.155, by + 0.05, 0.01]);
    }
  }
  // Bugkanone im Drehturm / chin gun in a turret
  const gunLen = f === 'dravon' ? 0.17 : 0.08;
  const gk = f === 'dravon' ? 1.8 : 1;
  b.add(lite ? geo.ico(0.022, 0) : geo.sphere(0.024, 8, 4), mat.dark, { p: [0, by - 0.005, 0.13] });
  b.cyl(0.006 * gk, 0.006 * gk, gunLen, 6, mat.metal, [0, by - 0.01, 0.13 + gunLen / 2], [HALF_PI, 0, 0]);
  if (!lite) b.cyl(0.01 * gk, 0.008 * gk, 0.02, 6, mat.dark, [0, by - 0.01, 0.13 + gunLen], [HALF_PI, 0, 0]);
  // Emblem auf dem Ausleger / emblem on boom
  emblemSides(b, f, L, 0.022, by + 0.072, -0.17, lite ? 0 : 0.028);
  // Hauptrotor mit Taumelscheibe / main rotor with swash plate
  b.cyl(0.014, 0.018, 0.05, 8, mat.dark, [0, topY + 0.02, 0.0]);
  b.cyl(0.03, 0.03, 0.02, seg, L.trim, [0, topY + 0.045, 0.0]);
  if (!lite) b.add(geo.hemi(0.02, 8, 2), mat.dark, { p: [0, topY + 0.055, 0] });
  const blades = f === 'alvenia' || f === 'velkar' ? 4 : f === 'meridon' ? 3 : 4;
  for (let i = 0; i < blades; i++) {
    const a = Math.PI / 4 + (i / blades) * Math.PI * 2;
    b.group({ p: [0, topY + 0.05, 0], r: [0, a, 0] }, () => {
      b.add(lite ? geo.box(0.04, 0.008, 0.4) : geo.cbox(0.042, 0.008, 0.4, 0.012), mat.dark, { p: [0, 0, 0.21], r: [0, 0, 0.08] });
      b.box(0.044, 0.009, 0.04, L.trim, [0, 0, 0.39], [0, 0, 0.08]);
      if (!lite) {
        b.box(0.044, 0.009, 0.012, L.secondary, [0, 0, 0.33], [0, 0, 0.08]);
        b.add(geo.rbox(0.05, 0.016, 0.05, 0.005), mat.metal, { p: [0, 0, 0.045] });
      }
    });
  }
  return b;
}

