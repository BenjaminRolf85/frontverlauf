/**
 * Siegeswunder der Fraktionen / faction victory wonders.
 * - portal (Zyrr): Dimensionsportal aus Chitinboegen mit Runen und Wirbelscheibe / dimensional portal of chitin arches with runes and swirl disc
 * - coreDrill (Vesper): fahrbarer Erdkern-Bohrer mit Glutofen, Ketten, Glocken, Bannern / mobile earth-core drill with furnace, chains, bells, banners
 * - hackRelay (Nexus): Antennenmast auf einem Berg mit Schuesseln und Datenleuchten / antenna mast on a mountain with dishes and data glow
 * - fusionPlant (Velkar): Fusionskraftwerk mit Tokamak, Kuehltuermen und Laboren (2x2 Felder) / fusion plant with tokamak, cooling towers and labs (2x2 tiles)
 * - waal (Dravon): superschwerer Landkreuzer mit mehreren Tuermen / super-heavy land cruiser with several turrets
 *
 * Stufe 0 = im Bau, 1 = gebaut und ladend, 2 = fertig / stage 0 = under construction, 1 = built and charging, 2 = complete.
 * Massstab: das Brett skaliert Einheitenmodelle mit 1.25; alle Masse hier sind in Brett-Feldern angegeben und werden am
 * Ende durch 1.25 geteilt (1 Feld = 1.0). Ursprung unten mittig auf dem Ankerfeld, Blick +z.
 * Scale: the board scales unit models by 1.25; all sizes here are in board tiles and are divided by 1.25 at the end
 * (1 tile = 1.0). Origin bottom centre of the anchor tile, facing +z.
 * fusionPlant belegt das Ankerfeld und je ein Feld in +x und +z (Brett: x und Zeile y -> +z); es darf nicht gedreht werden.
 * fusionPlant covers the anchor tile plus one tile in +x and +z (board: x and row y -> +z); it must not be rotated.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { dish, flagPole } from './architecture';
import { addEmblem } from './emblems';
import { Builder, geo, memo, mix, rng, shade, withDetail, type ColorLike, type V3 } from './kit';
import { look, mat } from './look';
import { gun, tracks } from './tanks';

export const WONDER_TYPES = ['portal', 'coreDrill', 'hackRelay', 'fusionPlant', 'waal'] as const;
export type WonderType = (typeof WONDER_TYPES)[number];
/** Stufe / stage: 0 im Bau / under construction, 1 gebaut und ladend / built and charging, 2 fertig / complete */
export type WonderStage = 0 | 1 | 2;

const HALF_PI = Math.PI / 2;
/** Brett-Skalierung der Einheiten / board scale of unit models */
const BOARD_SCALE = 1.25;

/** Leuchtfarbe je Stufe / glow colour per stage */
function glow(c: ColorLike, stage: number, off: ColorLike = mat.dark): THREE.Color {
  return stage >= 2 ? mix(c, mat.white, 0.18) : stage === 1 ? mix(c, off, 0.45) : mix(c, off, 0.8);
}

/** Geruest aus Rohren in einem Quader / scaffolding of tubes in a box */
function scaffold(b: Builder, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, levels: number, c: ColorLike = mat.wood, r = 0.008) {
  const xs = [x0, x1], zs = [z0, z1];
  for (const x of xs) for (const z of zs) b.tube([x, y0, z], [x, y1, z], r, 5, c);
  for (let i = 1; i <= levels; i++) {
    const y = y0 + ((y1 - y0) * i) / levels;
    for (const z of zs) b.tube([x0, y, z], [x1, y, z], r * 0.8, 4, c);
    for (const x of xs) b.tube([x, y, z0], [x, y, z1], r * 0.8, 4, c);
    // Diagonalen und Laufbrett / diagonals and plank
    b.tube([x0, y - (y1 - y0) / levels, z1], [x1, y, z1], r * 0.7, 4, c);
    b.box(Math.abs(x1 - x0), 0.008, 0.05, mat.woodLight, [(x0 + x1) / 2, y, z1 - 0.03]);
  }
}

/** Kran mit Ausleger und Haken / crane with jib and hook */
function crane(b: Builder, x: number, z: number, h: number, jib: number, ry: number, c: ColorLike = mat.yellow) {
  b.group({ p: [x, 0, z], r: [0, ry, 0] }, () => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.tube([sx * 0.025, 0, sz * 0.025], [sx * 0.018, h, sz * 0.018], 0.006, 4, c);
    for (let i = 1; i < 6; i++) b.box(0.05, 0.005, 0.005, c, [0, (h * i) / 6, 0.025]);
    b.box(0.04, 0.03, jib + 0.12, c, [0, h + 0.015, jib / 2 - 0.06]);
    b.box(0.06, 0.05, 0.06, mat.concrete, [0, h - 0.01, -0.07]);
    b.tube([0, h, jib - 0.02], [0, h * 0.55, jib - 0.02], 0.002, 3, mat.dark);
    b.box(0.02, 0.02, 0.012, mat.dark, [0, h * 0.55, jib - 0.02]);
  });
}

// ---------- Portal (Zyrr) ----------

function portal(b: Builder, f: FactionId, stage: WonderStage) {
  const L = look(f);
  const stone = mat.alienSkinDark, chitin = mat.alienMetal, light = mat.alienMetalLight;
  const rune = glow(stage === 0 ? mat.acid : mat.xenoGlow, Math.max(1, stage));
  // Sockel: drei Stufen aus Chitinplatten / base: three steps of chitin plates
  for (let i = 0; i < 3; i++) {
    const r = 0.45 - i * 0.07;
    b.add(geo.cyl(r, r + 0.02, 0.05, 10), i % 2 ? stone : chitin, { p: [0, 0.025 + i * 0.05, 0] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + i * 0.3;
      b.box(0.03, 0.012, 0.012, rune, [Math.cos(a) * (r + 0.008), 0.03 + i * 0.05, Math.sin(a) * (r + 0.008)], [0, -a, 0]);
    }
  }
  const cy = 0.88, rx = 0.38, ry = 0.62, depth = 0.11;
  const n = 22;
  const full = stage >= 1;
  // Ringsegmente: im Bau nur untere Haelfte und eine Seite / ring segments: under construction only lower half and one side
  for (let i = 0; i < n; i++) {
    const a = -HALF_PI + ((i + 0.5) / n) * Math.PI * 2;
    if (!full && !(Math.sin(a) < 0.25 || (Math.cos(a) > 0 && Math.sin(a) < 0.8))) continue;
    const x = Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const t = Math.atan2(ry * Math.cos(a), -rx * Math.sin(a));
    const seg = (2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2)) / n;
    b.group({ p: [x, y, 0], r: [0, 0, t] }, () => {
      b.add(geo.rtaper(seg * 1.15, depth, seg * 0.95, depth * 0.8, 0.12, 0.02), i % 2 ? chitin : light, { p: [0, -0.04, 0] });
      // Rippe und Rune vorn und hinten / rib and rune front and back
      b.add(geo.rtaper(seg * 0.5, depth * 1.15, seg * 0.3, depth * 1.05, 0.05, 0.01), stone, { p: [0, -0.1, 0] });
      for (const s of [-1, 1]) {
        b.box(seg * 0.35, 0.03, 0.006, rune, [0, -0.035, s * (depth / 2 + 0.002)]);
        b.box(0.008, 0.05, 0.006, rune, [seg * 0.2 * (i % 2 ? 1 : -1), -0.05, s * (depth / 2 + 0.003)]);
      }
      // Dornen nach aussen / spines pointing outward
      if (i % 2 === 0) b.add(geo.cone(0.03, 0.14 + (i % 4 === 0 ? 0.08 : 0), 6), light, { p: [0, 0.07, 0] });
    });
  }
  // Klauenpfeiler links und rechts / claw pillars left and right
  for (const s of [-1, 1]) {
    const pts: V3[] = [[s * 0.4, 0.15, 0], [s * 0.44, 0.45, 0], [s * 0.42, 0.75, 0], [s * 0.36, 1.0, 0]];
    for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], 0.05 - i * 0.008, 8, stone, 0.045 - i * 0.008);
    b.add(geo.cone(0.035, 0.18, 6), chitin, { p: [s * 0.44, 0.62, 0.04], r: [0.6, 0, -s * 0.9] });
    b.add(geo.ico(0.03, 1), rune, { p: [s * 0.44, 0.45, 0.05] });
  }
  if (stage === 0) {
    // Geruest aus Stacheln und schwebende Bausteine / scaffolding of spines and floating blocks
    for (const [x0, x1] of [[-0.42, -0.1], [-0.3, 0.05]] as [number, number][]) {
      b.tube([x0, 0.15, -0.08], [x1, 1.25, -0.06], 0.012, 5, light);
      b.tube([x0, 0.15, 0.08], [x1, 1.25, 0.06], 0.012, 5, light);
    }
    for (let k = 0; k < 4; k++) b.tube([-0.4, 0.3 + k * 0.25, -0.08], [-0.2 + k * 0.05, 0.36 + k * 0.25, 0.08], 0.007, 4, light);
    for (let k = 0; k < 3; k++) {
      const a = 0.9 + k * 0.35;
      b.add(geo.rtaper(0.1, 0.1, 0.08, 0.08, 0.1, 0.02), chitin, { p: [-Math.cos(a) * 0.5, cy + Math.sin(a) * 0.55 + 0.1, 0.0], r: [0.3 * k, 0, a] });
      b.add(geo.torus(0.06, 0.004, 3, 16), rune, { p: [-Math.cos(a) * 0.5, cy + Math.sin(a) * 0.55 + 0.1, 0.0], r: [HALF_PI, 0, 0] });
    }
    // Bau-Grauer als Massstab / builder grey for scale: small glowing work lights
    for (const x of [-0.2, 0.15]) b.add(geo.ico(0.025, 1), mat.acid, { p: [x, 0.2, 0.3] });
    return;
  }
  // Energiescheibe mit Wirbelarmen / energy disc with swirl arms
  const discOuter = stage >= 2 ? mix(L.primary, mat.xenoGlow, 0.45) : mix(L.primary, mat.alienMetal, 0.55), discInner = stage >= 2 ? mix(mat.xenoGlow, mat.white, 0.45) : mix(mat.xenoGlow, mat.alienMetal, 0.6);
  b.add(geo.cyl(1, 1, 0.012, 40), discOuter, { p: [0, cy, 0], r: [HALF_PI, 0, 0], s: [rx * 0.86, 1, ry * 0.88] });
  b.add(geo.cyl(1, 1, 0.016, 32), discInner, { p: [0, cy, 0], r: [HALF_PI, 0, 0], s: [rx * 0.42, 1, ry * 0.42] });
  b.add(geo.cyl(1, 1, 0.02, 24), stage >= 2 ? mat.white : mix(mat.xenoGlow, mat.white, 0.2), { p: [0, cy, 0], r: [HALF_PI, 0, 0], s: [rx * 0.14, 1, ry * 0.14] });
  const arms = stage >= 2 ? 5 : 3;
  for (const side of [-1, 1]) for (let k = 0; k < arms; k++) {
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, a = (k / arms) * Math.PI * 2 + t * 3.4;
      const r = 0.12 + t * 0.8;
      pts.push([Math.cos(a) * rx * 0.86 * r, cy + Math.sin(a) * ry * 0.88 * r, side * 0.012]);
    }
    const armC = stage >= 2 ? (i: number) => (i < 5 ? mat.acid : mix(mat.xenoGlow, mat.white, 0.2)) : (i: number) => (i < 5 ? mix(mat.acid, mat.alienMetal, 0.4) : mix(mat.xenoGlow, mat.alienMetal, 0.5));
    for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], 0.014 * (1 - i / 12), 4, armC(i), 0.014 * (1 - (i + 1) / 12));
  }
  if (stage >= 2) {
    // Leuchtsaum am Innenrand / glowing rim on the inner edge
    b.add(geo.torus(1, 0.03, 6, 48), mat.acid, { p: [0, cy, 0], s: [rx * 0.86, ry * 0.88, 1] });
    // Funken und schwebende Splitter / sparks and floating shards
    const R = rng(7);
    for (let i = 0; i < 14; i++) {
      const a = R() * Math.PI * 2, r = 0.55 + R() * 0.3;
      b.add(geo.ico(0.012 + R() * 0.012, 0), i % 2 ? mat.acid : mat.xenoGlow, { p: [Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, (R() - 0.5) * 0.3] });
    }
    for (const s of [-1, 1]) b.add(geo.cone(0.05, 0.25, 8), mix(mat.xenoGlow, mat.white, 0.3), { p: [0, 0.32, s * 0.2], r: [s * -1.2, 0, 0] });
  }
  // Spitze mit Kristall / crown crystal on top
  b.add(geo.cone(0.05, 0.2, 6), chitin, { p: [0, cy + ry + 0.12, 0] });
  b.add(geo.ico(0.045, 1), rune, { p: [0, cy + ry + 0.06, 0.03] });
}

// ---------- Erdkern-Bohrer (Vesper) / core drill ----------

function coreDrill(b: Builder, f: FactionId, stage: WonderStage) {
  const L = look(f);
  const hot = glow(mat.ember, stage === 0 ? 1 : stage + (stage === 2 ? 0 : 0.5), mat.rustDark);
  const fire = stage >= 2 ? mat.yellow : mix(mat.yellow, mat.rustDark, 0.5);
  // schwere Doppelketten / heavy double tracks
  tracks(b, { x: 0.27, w: 0.15, len: 0.88, h: 0.17, wheels: 7, wr: 0.055, sprocket: L.trim, hub: mat.rustDark, lite: false, links: 16 });
  // Fahrgestell / chassis
  b.add(geo.cbox(0.42, 0.12, 0.84, 0.03), mat.rust, { p: [0, 0.2, 0] });
  b.add(geo.cbox(0.72, 0.03, 0.86, 0.03), mat.rustDark, { p: [0, 0.18, 0] });
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.03, 0.08, 0.8, 0.01), L.hull, { p: [s * 0.36, 0.13, 0] });
    for (let i = 0; i < 9; i++) b.box(0.012, 0.012, 0.012, mat.gunmetal, [s * 0.376, 0.15, -0.36 + i * 0.09]);
  }
  // Ofen hinten mit Glutgitter / furnace at the rear with ember grate
  const fz = -0.2;
  b.add(geo.cyl(0.17, 0.2, 0.34, 14), mat.rustDark, { p: [0, 0.43, fz] });
  b.add(geo.cyl(0.18, 0.18, 0.03, 14), mat.rust, { p: [0, 0.3, fz] });
  b.add(geo.cyl(0.175, 0.175, 0.03, 14), mat.rust, { p: [0, 0.56, fz] });
  b.add(geo.cone(0.18, 0.12, 14), mat.rust, { p: [0, 0.66, fz] });
  // Glutoeffnung vorn mit Gitterstaeben / ember mouth at the front with bars
  b.add(geo.cbox(0.16, 0.13, 0.04, 0.02), hot, { p: [0, 0.43, fz + 0.18] });
  b.add(geo.cbox(0.09, 0.07, 0.04, 0.015), fire, { p: [0, 0.42, fz + 0.19] });
  for (let i = 0; i < 5; i++) b.box(0.01, 0.15, 0.012, mat.ink, [-0.06 + i * 0.03, 0.43, fz + 0.205]);
  // Schornsteine mit Glut und Rauch / chimneys with ember and smoke
  for (const s of [-1, 1]) {
    b.cyl(0.035, 0.045, 0.3, 10, mat.rust, [s * 0.1, 0.78, fz - 0.06]);
    b.add(geo.cyl(0.04, 0.04, 0.02, 10, true), hot, { p: [s * 0.1, 0.93, fz - 0.06] });
    for (let k = 0; k < (stage + 1); k++) b.add(geo.ico(0.045 + k * 0.012, 1), mix(mat.cloudShade, mat.ink, 0.25 + k * 0.1), { p: [s * 0.1 + k * 0.02, 0.99 + k * 0.07, fz - 0.07 - k * 0.03] });
  }
  // Bohrturm vorn, Bohrer schraeg nach unten / derrick at the front, drill angled down
  const pivot: V3 = [0, 0.62, 0.14];
  for (const s of [-1, 1]) {
    b.tube([s * 0.17, 0.26, -0.02], pivot, 0.022, 6, mat.gunmetal);
    b.tube([s * 0.17, 0.26, 0.32], pivot, 0.018, 6, mat.gunmetal);
  }
  b.add(geo.sphere(0.06, 12, 8), mat.gunmetal, { p: pivot });
  const dir = new THREE.Vector3(0, -0.62, 0.78).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  const e = new THREE.Euler().setFromQuaternion(q);
  b.group({ p: pivot, r: [e.x, e.y, e.z] }, () => {
    // Motorgehaeuse / motor housing
    b.add(geo.cyl(0.075, 0.075, 0.16, 14), mat.rust, { p: [0, -0.1, 0] });
    for (let i = 0; i < 3; i++) b.add(geo.torus(0.078, 0.008, 4, 14), mat.gunmetal, { p: [0, -0.04 - i * 0.05, 0], r: [HALF_PI, 0, 0] });
    // Bohrspitze mit Spiralnut / drill bit with spiral flute
    const len = 0.5, r0 = 0.075;
    b.add(geo.cone(r0, len, 16), mat.metal, { p: [0, -0.18 - len / 2, 0], r: [Math.PI, 0, 0] });
    for (let k = 0; k < 2; k++) {
      const pts: V3[] = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26, a = t * Math.PI * 7 + k * Math.PI;
        const r = r0 * (1 - t) + 0.006;
        pts.push([Math.cos(a) * r, -0.18 - t * len, Math.sin(a) * r]);
      }
      for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], 0.012 * (1 - i / 30), 4, mat.metalLight);
    }
    b.add(geo.cone(0.02, 0.05, 8), hot, { p: [0, -0.18 - len - 0.01, 0], r: [Math.PI, 0, 0] });
  });
  // Erdbrocken und Glut am Bohrpunkt / earth clods and ember at the bore point
  const bore: V3 = [0, 0.04, 0.48];
  b.add(geo.cyl(0.11, 0.13, 0.03, 12), hot, { p: bore });
  const R = rng(3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.add(geo.dodeca(0.03 + R() * 0.02), mat.rockDark, { p: [bore[0] + Math.cos(a) * 0.15, 0.03, bore[2] + Math.sin(a) * 0.08] });
  }
  // Glockengalgen mit drei Glocken / bell gallows with three bells
  const gz = 0.02, gy = 0.27;
  for (const s of [-1, 1]) b.tube([s * 0.19, gy, gz], [s * 0.19, gy + 0.3, gz], 0.012, 6, mat.wood);
  b.tube([-0.21, gy + 0.3, gz], [0.21, gy + 0.3, gz], 0.012, 6, mat.wood);
  for (const x of [-0.12, 0, 0.12]) {
    b.tube([x, gy + 0.3, gz], [x, gy + 0.24, gz], 0.003, 3, mat.dark);
    b.add(geo.hemi(0.035, 12, 4), mat.gold, { p: [x, gy + 0.2, gz], r: [Math.PI, 0, 0], s: [1, 1.3, 1] });
    b.add(geo.cyl(0.037, 0.037, 0.008, 12, true), shade(mat.gold, 0.7), { p: [x, gy + 0.15, gz] });
  }
  // Ketten an den Flanken / chains on the flanks
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) {
    const t = i / 11;
    b.add(geo.torus(0.014, 0.004, 4, 10), mat.metal, { p: [s * 0.23, 0.32 - Math.sin(t * Math.PI) * 0.08, -0.38 + t * 0.6], r: [0, i % 2 ? HALF_PI : 0, HALF_PI] });
  }
  // rote Kultbanner / red cult banners
  for (const [x, z] of [[-0.3, -0.38], [0.3, -0.38], [-0.3, 0.33]] as [number, number][]) flagPole(b, 'vesper', x, 0.2, z, 0.5, 1.5);
  addEmblem(b, 'vesper', 0.08, 0.012, mat.bone, { p: [0, 0.48, fz - 0.185], r: [0, Math.PI, 0] });
  // Knochenschmuck vorn / bone ornaments at the front
  for (let i = 0; i < 5; i++) b.add(geo.cone(0.018, 0.08, 6), mat.bone, { p: [-0.16 + i * 0.08, 0.22, 0.43], r: [HALF_PI + 0.3, 0, 0] });
}

// ---------- Hack-Relais (Nexus) / hack relay ----------

function hackRelay(b: Builder, f: FactionId, stage: WonderStage) {
  const L = look(f);
  const metal = mat.gunmetal, plate = L.jacket;
  const g = glow(mat.cyanGlow, stage, mat.gunmetal);
  // Berg aus Felsbrocken / mountain of rocks
  const R = rng(11);
  b.add(geo.cone(0.46, 0.42, 9), mat.rock, { p: [0, 0.21, 0] });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + R() * 0.3, r = 0.3 + R() * 0.12;
    b.add(geo.dodeca(0.07 + R() * 0.06), i % 3 ? mat.rock : mat.rockDark, { p: [Math.cos(a) * r, 0.04 + R() * 0.12, Math.sin(a) * r], r: [R() * 3, R() * 3, 0], s: [1, 0.7, 1] });
  }
  for (let i = 0; i < 4; i++) b.add(geo.cone(0.05, 0.05, 6), mat.snow, { p: [Math.cos(i * 1.7) * 0.18, 0.33, Math.sin(i * 1.7) * 0.18], r: [0, i, 0] });
  // Fundament mit Sechseckplatte / foundation with hexagon plate
  const base = 0.4;
  b.add(geo.cyl(0.16, 0.18, 0.05, 6), metal, { p: [0, base, 0] });
  b.add(geo.cyl(0.13, 0.13, 0.008, 6), g, { p: [0, base + 0.03, 0] });
  // Gittermast: vier Beine, Streben / lattice mast: four legs, braces
  const top = stage === 0 ? 0.95 : 1.5;
  const w = (y: number) => 0.11 * (1 - (y - base) / (1.6 - base)) + 0.02;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) b.tube([sx * w(base), base, sz * w(base)], [sx * w(top), top, sz * w(top)], 0.011, 5, metal);
  const levels = Math.round((top - base) / 0.11);
  for (let i = 1; i <= levels; i++) {
    const y = base + ((top - base) * i) / levels, yp = base + ((top - base) * (i - 1)) / levels;
    for (let k = 0; k < 4; k++) {
      const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4];
      b.tube([ax * w(y), y, az * w(y)], [bx * w(y), y, bz * w(y)], 0.005, 4, metal);
      b.tube([ax * w(yp), yp, az * w(yp)], [bx * w(y), y, bz * w(y)], 0.004, 3, metal);
    }
    if (stage > 0 && i % 2 === 0) for (let k = 0; k < 4; k++) {
      const [ax, az] = legs[k];
      b.box(0.012, 0.012, 0.012, g, [ax * w(y), y, az * w(y)]);
    }
  }
  if (stage === 0) {
    // Baustelle: Kran, Kisten, lose Traeger / construction site: crane, crates, loose girders
    crane(b, 0.22, 0.18, 0.75, 0.3, -2.2, mat.yellow);
    for (let i = 0; i < 3; i++) b.box(0.25, 0.02, 0.02, metal, [-0.18, 0.42 + i * 0.022, 0.22], [0, 0.4, 0]);
    b.add(geo.cbox(0.08, 0.06, 0.08, 0.01), plate, { p: [0.2, 0.43, -0.2] });
    return;
  }
  // Plattformen mit Schuesseln und Sechseckpaneelen / platforms with dishes and hexagon panels
  for (const [y, n, r, tilt] of [[0.72, 3, 0.07, 0.9], [1.05, 4, 0.055, 0.7], [1.32, 3, 0.045, 0.5]] as [number, number, number, number][]) {
    b.add(geo.cyl(w(y) + 0.06, w(y) + 0.06, 0.02, 6), metal, { p: [0, y, 0] });
    b.add(geo.torus(w(y) + 0.06, 0.006, 3, 18), g, { p: [0, y + 0.012, 0], r: [HALF_PI, 0, 0] });
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 2;
      const d = w(y) + 0.06;
      dish(b, Math.cos(a) * d, y + 0.01, Math.sin(a) * d, r, tilt, plate, -a + HALF_PI);
      b.add(geo.cyl(r * 0.25, r * 0.25, 0.006, 8), g, { p: [Math.cos(a) * d, y + r * 1.05, Math.sin(a) * d] });
    }
  }
  // weisse Verkleidungsringe am Mast / white cladding rings on the mast
  for (const y of [0.55, 0.88, 1.2]) b.add(geo.cyl(w(y) + 0.02, w(y + 0.08) + 0.02, 0.08, 4), plate, { p: [0, y + 0.04, 0], r: [0, Math.PI / 4, 0] });
  // Sechseck-Paneele am Mast / hexagon panels on the mast
  for (let i = 0; i < 6; i++) {
    const y = 0.55 + i * 0.12, s = i % 2 ? 1 : -1;
    b.add(geo.cyl(0.04, 0.04, 0.01, 6), plate, { p: [s * (w(y) + 0.01), y, 0], r: [0, 0, HALF_PI] });
    b.add(geo.cyl(0.02, 0.02, 0.012, 6), g, { p: [s * (w(y) + 0.012), y, 0], r: [0, 0, HALF_PI] });
  }
  // Spitze mit Leuchtfeuer und Ringen / top with beacon and rings
  b.tube([0, top, 0], [0, top + 0.14, 0], 0.008, 6, metal);
  b.add(geo.ico(0.03, 1), stage >= 2 ? mat.white : g, { p: [0, top + 0.15, 0] });
  for (let i = 0; i < (stage >= 2 ? 3 : 1); i++) b.add(geo.torus(0.05 + i * 0.035, 0.005, 3, 20), g, { p: [0, top + 0.06 + i * 0.03, 0], r: [HALF_PI, 0, 0] });
  // Kabel den Berg hinab / cables down the mountain
  for (const [x, z] of [[0.35, 0.2], [-0.3, 0.28], [0.1, -0.38]] as [number, number][]) {
    const pts: V3[] = [[0, base + 0.02, 0], [x * 0.5, 0.33, z * 0.5], [x, 0.08, z]];
    for (let i = 0; i < pts.length - 1; i++) b.tube(pts[i], pts[i + 1], 0.009, 5, mat.dark);
    b.add(geo.cbox(0.06, 0.05, 0.05, 0.01), plate, { p: [x, 0.05, z] });
    b.box(0.04, 0.01, 0.052, g, [x, 0.06, z]);
  }
  // Datenstrahl nach oben (fertig) / data beam upward (complete)
  if (stage >= 2) for (let i = 0; i < 4; i++) b.box(0.006, 0.08, 0.006, mat.cyanGlow, [0, top + 0.25 + i * 0.1, 0]);
  addEmblem(b, 'nexus', 0.06, 0.01, g, { p: [0, base + 0.12, 0.12] });
}

// ---------- Fusionskraftwerk (Velkar) / fusion plant ----------

/** Kuehlturm (Hyperboloid) / cooling tower (hyperboloid) */
function coolingTower(b: Builder, x: number, z: number, h: number, r: number, c: ColorLike, steam: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(r * (0.62 + 0.38 * Math.pow(Math.abs(t - 0.65) / 0.65, 1.6)), t * h));
  }
  b.add(new THREE.LatheGeometry(pts, 20), c, { p: [x, 0, z] });
  b.add(geo.cyl(r * 0.66, r * 0.66, 0.01, 20, true), shade(c, 0.8), { p: [x, h - 0.004, z] });
  b.add(geo.cyl(r * 0.6, r * 0.6, 0.006, 20), mat.dark, { p: [x, h - 0.01, z] });
  for (let k = 0; k < 2; k++) b.add(geo.torus(r * (0.98 - k * 0.2), 0.004, 3, 20), mat.white, { p: [x, h * (0.12 + k * 0.08), z], r: [HALF_PI, 0, 0] });
  for (let k = 0; k < steam; k++) b.add(geo.ico(r * (0.55 + k * 0.18), 1), k ? mat.cloudShade : mat.cloud, { p: [x + k * 0.04, h + 0.06 + k * 0.1, z - k * 0.03] });
}

function fusionPlant(b: Builder, f: FactionId, stage: WonderStage) {
  const L = look(f);
  const grey = mat.concrete, greyL = mat.concreteLight, green = L.secondary, ice = L.primary;
  const plasma = glow(green, stage, mat.gunmetal);
  // Fundamentplatte ueber 2x2 Felder / foundation slab over 2x2 tiles
  const X0 = -0.46, X1 = 1.46, Z0 = -0.46, Z1 = 1.46;
  b.add(geo.cbox(X1 - X0, 0.04, Z1 - Z0, 0.04), greyL, { p: [0.5, 0.02, 0.5] });
  b.add(geo.cbox(X1 - X0 - 0.06, 0.012, Z1 - Z0 - 0.06, 0.04), grey, { p: [0.5, 0.046, 0.5] });
  // Fahrwege mit Markierung / lanes with markings
  for (let i = 0; i < 8; i++) b.box(0.08, 0.004, 0.018, mat.yellow, [-0.3 + i * 0.25, 0.054, 1.36]);
  const tc: V3 = [0.5, 0.05, 0.5];
  if (stage === 0) {
    // Fundamente, Teil-Torus, Geruest, Kraene / foundations, partial torus, scaffolding, cranes
    b.add(geo.cyl(0.52, 0.52, 0.06, 28), mat.concreteDark, { p: [0.5, 0.08, 0.5] });
    for (let k = 0; k < 10; k++) {
      const a = (k / 16) * Math.PI * 2;
      b.box(0.07, 0.2, 0.07, grey, [0.5 + Math.cos(a) * 0.38, 0.2, 0.5 + Math.sin(a) * 0.38], [0, -a, 0]);
    }
    b.add(new THREE.TorusGeometry(0.38, 0.13, 10, 28, Math.PI * 1.05), ice, { p: [0.5, 0.36, 0.5], r: [HALF_PI, 0, 0] });
    scaffold(b, -0.05, 0.4, 0.95, 1.35, 0.05, 0.6, 4, mat.metal);
    scaffold(b, 1.0, 1.35, -0.35, 0.0, 0.05, 0.45, 3, mat.metal);
    b.add(new THREE.LatheGeometry([new THREE.Vector2(0.2, 0), new THREE.Vector2(0.15, 0.2)], 18), grey, { p: [1.15, 0.05, 1.15] });
    crane(b, -0.25, 0.4, 0.95, 0.5, 2.0);
    crane(b, 1.3, 0.6, 0.85, 0.45, -1.4);
    for (let i = 0; i < 4; i++) b.add(geo.cyl(0.04, 0.04, 0.3, 10), ice, { p: [0.95, 0.09 + (i % 2) * 0.08, 1.05 + i * 0.09], r: [0, 0, HALF_PI] });
    return;
  }
  // Tokamak: Sockel, Torus mit Magnetspulen, Plasmaring / tokamak: plinth, torus with magnet coils, plasma ring
  b.add(geo.cyl(0.58, 0.62, 0.1, 32), mat.concreteDark, { p: [0.5, 0.1, 0.5] });
  const ty = 0.36, R0 = 0.4, r0 = 0.14;
  b.add(new THREE.TorusGeometry(R0, r0, 14, 40), shade(ice, 0.95), { p: [tc[0], ty, tc[2]], r: [HALF_PI, 0, 0] });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    b.group({ p: [tc[0] + Math.cos(a) * R0, ty, tc[2] + Math.sin(a) * R0], r: [0, -a, 0] }, () => {
      b.add(new THREE.TorusGeometry(r0 + 0.025, 0.022, 6, 16), k % 2 ? green : mat.gunmetal, { r: [0, HALF_PI, 0], s: [1, 1.15, 1] });
    });
  }
  // Plasmafenster rundum oben / plasma window band on top
  b.add(new THREE.TorusGeometry(R0, 0.035, 8, 48), plasma, { p: [tc[0], ty + r0 - 0.005, tc[2]], r: [HALF_PI, 0, 0] });
  b.add(new THREE.TorusGeometry(R0 - r0 + 0.004, 0.03, 8, 40), plasma, { p: [tc[0], ty, tc[2]], r: [HALF_PI, 0, 0] });
  // Zentralsaeule mit Leuchtkern / central column with glowing core
  b.add(geo.cyl(0.12, 0.15, 0.5, 16), greyL, { p: [tc[0], 0.35, tc[2]] });
  b.add(geo.cyl(0.07, 0.07, 0.52, 12), plasma, { p: [tc[0], 0.36, tc[2]] });
  b.add(geo.cyl(0.16, 0.12, 0.05, 16), mat.gunmetal, { p: [tc[0], 0.62, tc[2]] });
  if (stage >= 2) {
    b.add(geo.ico(0.08, 2), mix(green, mat.white, 0.5), { p: [tc[0], 0.7, tc[2]] });
    for (let i = 0; i < 3; i++) b.add(new THREE.TorusGeometry(0.15 + i * 0.07, 0.008, 4, 28), mix(green, mat.white, 0.3), { p: [tc[0], 0.72 + i * 0.05, tc[2]], r: [HALF_PI, 0, 0] });
  }
  // Kuehltuerme hinten / cooling towers at the back
  const steam = stage >= 2 ? 3 : 2;
  coolingTower(b, 1.18, -0.18, 0.62, 0.21, greyL, steam);
  coolingTower(b, 1.2, 0.36, 0.5, 0.18, greyL, steam - 1);
  // Labor- und Leitgebaeude vorn links / lab and control buildings front left
  const labs: [number, number, number, number, number][] = [[-0.18, 1.18, 0.4, 0.22, 0.32], [0.3, 1.25, 0.32, 0.16, 0.24], [-0.24, 0.62, 0.3, 0.3, 0.26]];
  for (const [x, z, w, h, d] of labs) {
    b.add(geo.cbox(w, h, d, 0.02), ice, { p: [x, 0.05 + h / 2, z] });
    b.add(geo.cbox(w + 0.02, 0.025, d + 0.02, 0.02), mat.gunmetal, { p: [x, 0.05 + h + 0.012, z] });
    // Fensterbaender / window bands
    for (let k = 0; k < Math.floor(h / 0.08); k++) {
      b.box(w * 0.86, 0.025, 0.006, stage >= 2 ? mat.windowLit : mat.window, [x, 0.1 + k * 0.08, z + d / 2 + 0.002]);
      b.box(0.006, 0.025, d * 0.8, mat.window, [x - w / 2 - 0.002, 0.1 + k * 0.08, z]);
    }
    b.box(w * 0.5, 0.008, 0.02, green, [x, 0.05 + h + 0.03, z + d / 2 - 0.01]);
  }
  dish(b, -0.24, 0.36, 0.62, 0.07, 0.7, mat.white, 0.5);
  addEmblem(b, 'velkar', 0.06, 0.01, green, { p: [-0.18, 0.2, 1.345] });
  // Rohrleitungen / pipes
  const pipe = (a: V3, c: V3, r = 0.03, col: ColorLike = mat.metal) => b.tube(a, c, r, 10, col);
  pipe([0.85, 0.2, 0.5], [1.05, 0.2, 0.5]);
  pipe([1.05, 0.2, 0.5], [1.05, 0.2, -0.12]);
  pipe([0.5, 0.18, 0.95], [0.5, 0.18, 1.12], 0.035, green);
  pipe([0.5, 0.18, 1.12], [0.12, 0.18, 1.12], 0.035, green);
  pipe([0.12, 0.25, 0.5], [-0.1, 0.25, 0.6], 0.025);
  for (const [x, z] of [[1.05, 0.2], [1.05, -0.05], [0.32, 1.12]] as [number, number][]) b.box(0.05, 0.16, 0.05, mat.gunmetal, [x, 0.12, z]);
  // Hochspannungsmasten und Tanks / pylons and tanks
  for (const [x, z] of [[1.3, 1.3], [0.85, 1.32]] as [number, number][]) {
    b.add(geo.cyl(0.08, 0.08, 0.2, 14), greyL, { p: [x, 0.15, z] });
    b.add(geo.hemi(0.08, 14, 3), greyL, { p: [x, 0.25, z] });
    b.box(0.162, 0.03, 0.01, green, [x, 0.2, z + 0.075]);
  }
  for (const s of [-1, 1]) b.add(geo.cbox(0.04, 0.03, 0.04, 0.01), plasma, { p: [0.5 + s * 0.6, 0.075, 0.5] });
}

// ---------- Waal (Dravon) ----------

function waal(b: Builder, f: FactionId, stage: WonderStage) {
  const L = look(f);
  const hull = mix(L.hull, mat.concrete, 0.3), hullD = shade(hull, 0.72), gold = L.secondary;
  // vier Kettenlaeufe (je Seite zwei) / four track runs (two per side)
  for (const x of [0.25, 0.42]) tracks(b, { x, w: 0.15, len: 1.0, h: 0.19, wheels: 8, wr: 0.055, sprocket: gold, hub: hullD, lite: false, links: 18, rollers: 4 });
  // Wanne: lange Keilform mit Schuerzen / hull: long wedge with skirts
  b.add(geo.profileZY([[-0.5, 0.06], [0.42, 0.06], [0.56, 0.2], [0.44, 0.34], [-0.46, 0.36], [-0.53, 0.2]], 0.62), hull);
  b.add(geo.profileZY([[-0.5, 0.33], [0.42, 0.33], [0.46, 0.35], [-0.47, 0.37]], 0.66), hullD);
  for (const s of [-1, 1]) {
    b.add(geo.cbox(0.03, 0.14, 0.98, 0.01), hull, { p: [s * 0.52, 0.22, 0] });
    b.box(0.034, 0.016, 0.98, gold, [s * 0.52, 0.29, 0]);
    // Nietenreihen / rivet rows
    for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) b.box(0.012, 0.012, 0.012, hullD, [s * 0.537, 0.18 + r * 0.07, -0.45 + i * 0.06]);
    addEmblem(b, 'dravon', 0.06, 0.01, gold, { p: [s * 0.54, 0.22, 0.15], r: [0, s * HALF_PI, 0] });
  }
  // Bugplatte mit Rammsporn und Scheinwerfern / glacis with ram and headlights
  for (let i = 0; i < 9; i++) b.box(0.012, 0.012, 0.012, hullD, [-0.28 + i * 0.07, 0.3, 0.47]);
  b.add(geo.cbox(0.5, 0.06, 0.06, 0.02), hullD, { p: [0, 0.1, 0.55] });
  for (const s of [-1, 1]) {
    b.cyl(0.03, 0.035, 0.03, 12, hullD, [s * 0.2, 0.25, 0.51], [HALF_PI + 0.6, 0, 0]);
    b.cyl(0.025, 0.025, 0.006, 12, mat.yellow, [s * 0.2, 0.26, 0.525], [HALF_PI + 0.6, 0, 0]);
  }
  // Motordeck hinten mit Gittern und Auspuff / rear engine deck with grilles and exhausts
  for (let i = 0; i < 6; i++) b.box(0.4, 0.008, 0.02, mat.ink, [0, 0.375, -0.4 + i * 0.035]);
  for (const s of [-1, 1]) b.cyl(0.03, 0.035, 0.14, 10, mat.darkMid, [s * 0.24, 0.43, -0.42]);
  addEmblem(b, 'dravon', 0.07, 0.01, gold, { p: [0, 0.2, -0.535], r: [0, Math.PI, 0] });
  if (stage === 0) {
    // offener Turmring und Geruest / open turret ring and scaffolding
    b.add(geo.cyl(0.22, 0.22, 0.03, 24, true), gold, { p: [0, 0.385, 0.0] });
    b.add(geo.cyl(0.2, 0.2, 0.02, 24), mat.dark, { p: [0, 0.375, 0.0] });
    scaffold(b, -0.3, 0.3, -0.3, 0.3, 0.37, 0.72, 2, mat.metal, 0.007);
    crane(b, 0.48, -0.42, 0.75, 0.5, -2.5);
    for (let i = 0; i < 3; i++) b.cyl(0.035, 0.035, 0.5, 10, hullD, [-0.62, 0.04 + i * 0.07, 0.1 - (i % 2) * 0.04], [HALF_PI, 0, 0]);
    return;
  }
  // Hauptturm mit Riesenkanone / main turret with massive gun
  const ty = 0.37, tz = -0.02;
  b.add(geo.cyl(0.24, 0.26, 0.04, 24), hullD, { p: [0, ty + 0.02, tz] });
  b.add(geo.profileZY([[-0.26, 0], [0.18, 0], [0.26, 0.08], [0.2, 0.17], [-0.24, 0.18], [-0.3, 0.1]], 0.42), hull, { p: [0, ty + 0.04, tz] });
  // Goldkante nur am Turmrand / gold trim only along the turret edge
  for (const s of [-1, 1]) b.box(0.012, 0.016, 0.42, gold, [s * 0.212, ty + 0.205, tz - 0.03]);
  b.box(0.43, 0.016, 0.012, gold, [0, ty + 0.205, tz - 0.25]);
  // Dachluken und Periskope / roof hatches and periscopes
  b.add(geo.cyl(0.045, 0.045, 0.012, 14), hullD, { p: [0.09, ty + 0.225, tz - 0.12] });
  for (const x of [-0.04, 0.12]) b.add(geo.cbox(0.03, 0.025, 0.025, 0.006), mat.dark, { p: [x, ty + 0.23, tz + 0.1] });
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) b.box(0.01, 0.01, 0.01, hullD, [s * 0.215, ty + 0.12, tz - 0.2 + i * 0.055]);
  addEmblem(b, 'dravon', 0.065, 0.01, gold, { p: [0.222, ty + 0.12, tz], r: [0, HALF_PI, 0] });
  addEmblem(b, 'dravon', 0.065, 0.01, gold, { p: [-0.222, ty + 0.12, tz], r: [0, -HALF_PI, 0] });
  // Mantelblende und Doppelrohr / mantlet and twin barrel
  b.add(geo.cbox(0.26, 0.12, 0.08, 0.03), hullD, { p: [0, ty + 0.12, tz + 0.27] });
  for (const x of [-0.06, 0.06]) gun(b, x, ty + 0.12, tz + 0.3, 0.55, 0.026, hullD, { brake: 'big', sleeves: 2, lite: false, seg: 14 });
  // Kommandantenkuppel / commander's cupola
  b.add(geo.cyl(0.06, 0.07, 0.05, 16), hullD, { p: [-0.1, ty + 0.25, tz - 0.08] });
  b.add(geo.cyl(0.05, 0.05, 0.012, 16), gold, { p: [-0.1, ty + 0.28, tz - 0.08] });
  for (let i = 0; i < 5; i++) b.box(0.02, 0.012, 0.006, mat.glassDark, [-0.1 + Math.sin(i * 1.25) * 0.065, ty + 0.255, tz - 0.08 + Math.cos(i * 1.25) * 0.065], [0, i * 1.25, 0]);
  if (stage >= 2) {
    // zwei Nebentuerme vorn und Flak hinten / two secondary turrets at the front and flak at the rear
    for (const s of [-1, 1]) {
      const x = s * 0.24, z = 0.33, y = 0.36;
      b.add(geo.cyl(0.075, 0.085, 0.07, 18), hull, { p: [x, y + 0.035, z] });
      b.add(geo.hemi(0.075, 18, 4), hull, { p: [x, y + 0.07, z], s: [1, 0.55, 1] });
      b.add(geo.torus(0.078, 0.006, 4, 18), gold, { p: [x, y + 0.07, z], r: [HALF_PI, 0, 0] });
      gun(b, x, y + 0.06, z + 0.06, 0.16, 0.012, hullD, { brake: 'ring', sleeves: 1, lite: false });
    }
    const az = -0.38, ay = 0.38;
    b.add(geo.cyl(0.07, 0.08, 0.05, 16), hull, { p: [0.18, ay + 0.025, az] });
    for (const dx of [-0.02, 0.02]) b.cyl(0.008, 0.008, 0.2, 8, mat.dark, [0.18 + dx, ay + 0.1, az + 0.06], [0.9, 0, 0]);
    b.box(0.12, 0.05, 0.006, gold, [0.18, ay + 0.08, az + 0.05], [-0.2, 0, 0]);
    // Antennen mit Wimpel / antennas with pennant
    for (const x of [-0.2, -0.26]) b.tube([x, 0.37, -0.3], [x, 0.85, -0.38], 0.004, 4, mat.dark);
    b.add(geo.profileXY([[0, 0], [0.1, -0.025], [0, -0.05]], 0.004), gold, { p: [-0.2, 0.84, -0.375] });
  }
}

// ---------- Oeffentliche Schnittstelle / public API ----------

/**
 * Siegeswunder-Geometrie (zwischengespeichert, nicht veraendern) / victory wonder geometry (memoised, do not mutate).
 * Stufe 0 = im Bau, 1 = gebaut und ladend, 2 = fertig / stage 0 = under construction, 1 = built and charging, 2 = complete.
 */
export function wonderGeometry(type: WonderType, faction: FactionId, stage = 1): THREE.BufferGeometry {
  const st = Math.max(0, Math.min(2, Math.round(stage))) as WonderStage;
  return memo(`wonder|${type}|${faction}|${st}`, () => withDetail(1.3, true, () => {
    const b = new Builder();
    b.group({ s: 1 / BOARD_SCALE }, () => {
      switch (type) {
        case 'portal': portal(b, faction, st); break;
        case 'coreDrill': coreDrill(b, faction, st); break;
        case 'hackRelay': hackRelay(b, faction, st); break;
        case 'fusionPlant': fusionPlant(b, faction, st); break;
        case 'waal': waal(b, faction, st); break;
      }
    });
    return b.build();
  }));
}

/** Fraktion, der ein Wunder gehoert / faction a wonder belongs to */
export const WONDER_FACTION: Record<WonderType, FactionId> = {
  portal: 'zyrr', coreDrill: 'vesper', hackRelay: 'nexus', fusionPlant: 'velkar', waal: 'dravon',
};
