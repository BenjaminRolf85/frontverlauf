/**
 * Feindetails fuer Fahrzeuge und Maschinen (nur hohe Qualitaet, Detailrunde 4): Luken mit Scharnieren, Winkelspiegel,
 * Scheinwerfer mit Schutzbuegel, Werkzeug, Abschleppseil, Kanister, Planen, Kisten, Nebelwerfer, Auspufftoepfe, Gitter,
 * Nieten- und Bolzenreihen, Nahtlinien, Schmutzbaender sowie reiche Laufwerksteile (Laufrad, Treibrad, Leitrad).
 * Alle Helfer bauen nur, was man ruft; die Modelle rufen sie ausschliesslich unter fine(), die niedrige Qualitaet bleibt
 * unveraendert. Alle Farben kommen aus look.ts / tokens.ts.
 * Fine details for vehicles and machines (high quality only, detail round 4): hatches with hinges, periscopes, headlights
 * with guards, tools, tow cable, jerry cans, tarps, crates, smoke dischargers, mufflers, grilles, rivet and bolt rows,
 * seam lines, mud bands and rich running-gear parts (road wheel, sprocket, idler). The helpers only build what is called;
 * the models call them exclusively under fine(), low quality stays unchanged. All colours come from look.ts / tokens.ts.
 * Blick nach +z, Ursprung unten mittig / facing +z, origin bottom centre.
 */
import * as THREE from 'three';
import { semantic } from '../../design/tokens';
import { Builder, capsule, drum, geo, lathe, mix, rng, shade, type ColorLike, type V3 } from './kit';
import { mat } from './look';

const HALF_PI = Math.PI / 2;
const V = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** Schlamm / Erde fuer Schmutzbaender (aus Gelaendefarben) / mud / dirt for mud bands (from terrain colours) */
export const MUD = mix(semantic.terrainPlainSide, mat.dark, 0.66);
export const MUD_LIGHT = mix(semantic.terrainPlainSide, mat.dark, 0.48);

// ---------- Linien und Reihen / lines and rows ----------

/** Reihe kleiner Nieten von a nach c (n Stueck) / row of small rivets from a to c (n pieces) */
export function rivets(b: Builder, a: V3, c: V3, n: number, col: ColorLike, size = 0.005) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    b.box(size, size, size, col, [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t]);
  }
}

/** Duenne Naht- oder Plattenlinie von a nach c / thin seam or panel line from a to c */
export function seam(b: Builder, a: V3, c: V3, col: ColorLike, w = 0.003) {
  b.segment(V(a), V(c), (len) => geo.box(w, len, w), col);
}

/** Bolzenkranz in der xz-Ebene um p / bolt ring in the xz plane around p */
export function boltRing(b: Builder, p: V3, r: number, n: number, col: ColorLike, size = 0.006, a0 = 0) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    b.box(size, size * 0.8, size, col, [p[0] + Math.sin(a) * r, p[1], p[2] + Math.cos(a) * r], [0, a, 0]);
  }
}

/**
 * Schmutzflecken auf einer Seitenflaeche (x = +-x), deterministisch / mud patches on a side face (x = +-x), deterministic.
 * Unten dichter und dunkler, nach oben auslaufend / denser and darker at the bottom, fading upwards.
 */
export function mudBand(b: Builder, seed: number, x: number, y0: number, y1: number, z0: number, z1: number, n: number, both = true, cols: [ColorLike, ColorLike] = [MUD, MUD_LIGHT]) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const t = R();
    const y = y0 + t * t * (y1 - y0);
    const z = z0 + R() * (z1 - z0);
    const c = t < 0.5 ? cols[0] : cols[1];
    const h = 0.005 + (1 - t) * 0.01, d = 0.012 + R() * 0.026;
    for (const s of both ? [-1, 1] : [1]) b.box(0.004, h, d, c, [s * x, y, z + (s < 0 ? 0.013 : 0)]);
  }
}

// ---------- Luken, Spiegel, Lampen / hatches, periscopes, lamps ----------

/**
 * Runde Luke (geschlossen) mit Kragen, Scharnieren hinten, Griff und Verriegelung; Unterkante bei y.
 * Round hatch (closed) with a collar, hinges at the back, handle and latch; bottom at y.
 */
export function roundHatch(b: Builder, x: number, y: number, z: number, r: number, lid: ColorLike, ry = 0) {
  b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
    b.cyl(r * 1.16, r * 1.2, 0.008, 14, shade(lid, 0.78), [0, 0.004, 0]);
    b.cyl(r, r * 1.03, 0.009, 14, lid, [0, 0.0125, 0]);
    // Griff (Buegel) und Riegel / handle (bar) and latch
    b.box(r * 0.9, 0.004, 0.005, mat.dark, [0, 0.022, r * 0.25]);
    for (const s of [-1, 1]) b.box(0.004, 0.006, 0.004, mat.dark, [s * r * 0.42, 0.019, r * 0.25]);
    b.box(0.008, 0.005, 0.012, mat.metal, [0, 0.019, r * 0.72]);
    // Scharniere hinten / hinges at the back
    for (const s of [-1, 1]) {
      b.box(0.014, 0.008, 0.012, mat.dark, [s * r * 0.48, 0.016, -r * 0.98]);
      b.cyl(0.004, 0.004, 0.018, 6, mat.metal, [s * r * 0.48, 0.019, -r * 1.06], [0, 0, HALF_PI]);
    }
  });
}

/**
 * Rechteckige Luke mit Rahmen, Scharnieren und Griff; Unterkante bei y, Scharniere bei -z.
 * Rectangular hatch with frame, hinges and handle; bottom at y, hinges towards -z.
 */
export function squareHatch(b: Builder, x: number, y: number, z: number, w: number, d: number, lid: ColorLike, ry = 0) {
  b.group({ p: [x, y, z], r: [0, ry, 0] }, () => {
    b.add(geo.cbox(w + 0.01, 0.006, d + 0.01, 0.006), shade(lid, 0.74), { p: [0, 0.003, 0] });
    b.add(geo.cbox(w, 0.008, d, 0.005), lid, { p: [0, 0.01, 0] });
    b.box(w * 0.5, 0.004, 0.004, mat.dark, [0, 0.017, d * 0.3]);
    for (const s of [-1, 1]) {
      b.box(0.004, 0.005, 0.004, mat.dark, [s * w * 0.25, 0.015, d * 0.3]);
      b.box(0.014, 0.008, 0.01, mat.dark, [s * w * 0.32, 0.012, -d / 2 - 0.002]);
    }
  });
}

/** Winkelspiegel mit Glas und Regenschutz, Blick nach ry / periscope with glass and rain guard, looking towards ry */
export function periscope(b: Builder, x: number, y: number, z: number, ry: number, c: ColorLike, scale = 1) {
  b.group({ p: [x, y, z], r: [0, ry, 0], s: scale }, () => {
    b.add(geo.cbox(0.024, 0.016, 0.018, 0.004), c, { p: [0, 0.008, 0] });
    b.box(0.018, 0.008, 0.003, mat.glassDark, [0, 0.009, 0.0095]);
    b.box(0.028, 0.003, 0.008, shade(c, 0.75), [0, 0.0175, 0.008]);
  });
}

/** Scheinwerfer (Blick +z) mit Fassung, Glas und optionalem Schutzbuegel / headlight (facing +z) with housing, lens and optional guard */
export function headlight(b: Builder, x: number, y: number, z: number, r: number, c: ColorLike, guard = true) {
  b.add(drum(r * 0.95, r * 1.08, r * 1.4, 12), c, { p: [x, y, z], r: [HALF_PI, 0, 0] });
  b.add(drum(r * 0.8, r * 0.8, 0.003, 12), mat.lamp, { p: [x, y, z + r * 0.7 + 0.0015], r: [HALF_PI, 0, 0] });
  b.box(0.005, r * 0.9, 0.006, mat.dark, [x, y - r * 1.1, z - r * 0.2]);
  if (!guard) return;
  // Schutzbuegel: zwei Buegel vor dem Glas / guard: two hoops in front of the lens
  const zf = z + r * 0.7 + 0.008;
  for (const s of [-1, 1]) b.tube([x + s * r * 1.05, y - r * 0.9, z], [x + s * r * 1.05, y + r * 0.9, zf], 0.0018, 4, mat.dark);
  b.tube([x - r * 1.05, y + r * 0.9, zf], [x + r * 1.05, y + r * 0.9, zf], 0.0018, 4, mat.dark);
  b.box(0.0035, r * 1.8, 0.0035, mat.dark, [x, y, zf]);
}

/** Abschleppoese (Blick +z oder -z) / tow eye (facing +z or -z) */
export function towHook(b: Builder, x: number, y: number, z: number, dir: 1 | -1, c: ColorLike) {
  b.box(0.022, 0.016, 0.01, c, [x, y, z]);
  b.add(geo.torus(0.009, 0.0032, 3, 8), mat.dark, { p: [x, y, z + dir * 0.011], r: [0, 0, 0] });
}

// ---------- Werkzeug und Gepaeck / tools and stowage ----------

/**
 * Pionierwerkzeug: Schaufel, Axt und Brechstange nebeneinander mit Halteklammern; lokal liegen die Stiele entlang z,
 * die Auflageflaeche zeigt nach +y. Mit r auf eine Seitenwand drehen ([0, 0, -PI/2] fuer +x).
 * Pioneer tools: shovel, axe and crowbar side by side with clamps; locally the handles run along z, the support face
 * points to +y. Turn onto a side wall with r ([0, 0, -PI/2] for +x).
 */
export function toolSet(b: Builder, p: V3, r: V3, len = 0.12, kinds: ('shovel' | 'axe' | 'bar')[] = ['shovel', 'axe', 'bar']) {
  b.group({ p, r }, () => {
    kinds.forEach((k, i) => {
      const x = (i - (kinds.length - 1) / 2) * 0.016;
      if (k === 'shovel') {
        b.box(0.0055, 0.0055, len * 0.7, mat.wood, [x, 0.003, -len * 0.12]);
        b.box(0.014, 0.005, 0.005, mat.wood, [x, 0.003, -len * 0.47]);
        b.add(geo.cbox(0.022, 0.004, len * 0.28, 0.006), mat.metal, { p: [x, 0.003, len * 0.36] });
      } else if (k === 'axe') {
        b.box(0.0055, 0.0055, len * 0.85, mat.woodLight, [x, 0.003, 0]);
        b.add(geo.cbox(0.018, 0.005, 0.014, 0.003), mat.metal, { p: [x + 0.005, 0.003, len * 0.4] });
      } else {
        b.box(0.0045, 0.0045, len * 0.95, mat.darkMid, [x, 0.003, 0]);
      }
    });
    // Klammern / clamps
    const span = (kinds.length - 1) * 0.016 + 0.014;
    for (const z of [-len * 0.3, len * 0.18]) b.box(span, 0.004, 0.006, mat.dark, [0, 0.007, z]);
  });
}

/** Abschleppseil in zwei Straengen mit Oesen von a nach c (liegt auf der Flaeche) / tow cable in two strands with eyes from a to c */
export function towCable(b: Builder, a: V3, c: V3, col: ColorLike = mat.darkMid) {
  const dx = c[0] - a[0], dz = c[2] - a[2];
  const l = Math.hypot(dx, dz) || 1;
  const ox = (-dz / l) * 0.005, oz = (dx / l) * 0.005;
  for (const s of [-1, 1]) b.tube([a[0] + s * ox, a[1], a[2] + s * oz], [c[0] + s * ox, c[1], c[2] + s * oz], 0.0028, 5, col);
  const ry = Math.atan2(dx, dz);
  for (const [p, d] of [[a, -1], [c, 1]] as [V3, number][]) {
    b.add(geo.torus(0.008, 0.0028, 3, 8), col, { p: [p[0] + (dx / l) * d * 0.008, p[1], p[2] + (dz / l) * d * 0.008], r: [HALF_PI, 0, ry] });
    b.box(0.01, 0.006, 0.01, mat.dark, [p[0], p[1] - 0.002, p[2]]);
  }
}

/** Kanister (stehend, Blick ry) mit Griffen, Praegekreuz und Verschluss / jerry can (upright, facing ry) with handles, embossed cross and cap */
export function jerryCan(b: Builder, p: V3, ry: number, c: ColorLike, s = 1) {
  b.group({ p, r: [0, ry, 0], s }, () => {
    const w = 0.016, h = 0.05, d = 0.036;
    b.add(geo.cbox(w, h, d, 0.004), c, { p: [0, h / 2, 0] });
    // Praegekreuz auf beiden Flanken / embossed cross on both flanks
    for (const sx of [-1, 1]) for (const a of [-0.62, 0.62]) b.box(0.002, h * 0.95, 0.004, shade(c, 0.8), [sx * (w / 2 + 0.0005), h * 0.48, 0], [a, 0, 0]);
    // drei Griffe und Verschluss / three handles and cap
    for (const z of [-0.011, 0, 0.011]) b.box(0.006, 0.006, 0.0035, shade(c, 0.85), [0, h + 0.003, z]);
    b.cyl(0.0045, 0.0045, 0.008, 6, mat.dark, [0, h + 0.002, d * 0.38]);
  });
}

/** Planenrolle entlang x mit zwei Gurten / tarp roll along x with two straps */
export function tarpRoll(b: Builder, p: V3, len: number, r: number, c: ColorLike, strap: ColorLike = mat.dark, ry = 0) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.add(capsule(r, r, len, 12, 2, 0.6), c, { r: [0, 0, HALF_PI] });
    // Faltkante / fold
    b.box(len * 0.82, 0.003, 0.004, shade(c, 0.78), [0, r * 0.55, r * 0.8]);
    for (const x of [-len * 0.3, len * 0.3]) b.cyl(r * 1.07, r * 1.07, 0.006, 12, strap, [x, 0, 0], [0, 0, HALF_PI]);
  });
}

/** Holzkiste mit Bretterfugen und Bandeisen / wooden crate with plank joints and metal bands */
export function crate(b: Builder, p: V3, w: number, h: number, d: number, wood: ColorLike = mat.wood, band: ColorLike = mat.dark, ry = 0) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.add(geo.cbox(w, h, d, 0.004), wood, { p: [0, h / 2, 0] });
    for (let i = 1; i < 3; i++) {
      const y = (i / 3) * h;
      b.box(w + 0.001, 0.0025, d + 0.001, shade(wood, 0.72), [0, y, 0]);
    }
    for (const t of [-0.3, 0.3]) b.box(w + 0.003, h + 0.003, 0.005, band, [0, h / 2, t * d]);
  });
}

/** Munitionskiste mit Deckelkante, Griff und Verschluss / ammo box with lid lip, handle and latch */
export function ammoBox(b: Builder, p: V3, ry: number, c: ColorLike, s = 1) {
  b.group({ p, r: [0, ry, 0], s }, () => {
    b.add(geo.cbox(0.04, 0.026, 0.02, 0.004), c, { p: [0, 0.013, 0] });
    b.box(0.042, 0.005, 0.022, shade(c, 0.78), [0, 0.0255, 0]);
    b.box(0.016, 0.003, 0.004, mat.dark, [0, 0.03, 0]);
    b.box(0.006, 0.008, 0.003, mat.metal, [0, 0.02, 0.0115]);
  });
}

/** Nebelwerfer: n Becher auf einer Konsole, nach vorn-oben und zur Seite s geneigt / smoke dischargers: n cups on a bracket, angled up-forward and towards side s */
export function smokeRack(b: Builder, p: V3, s: 1 | -1, n: number, c: ColorLike, ry = 0) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.add(geo.cbox(0.012, 0.01, n * 0.013 + 0.006, 0.003), mat.dark, { p: [0, 0, 0] });
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.013;
      b.cyl(0.0058, 0.0058, 0.026, 8, c, [s * 0.004, 0.012, z], [0, 0, -s * 0.75]);
      b.cyl(0.0042, 0.0042, 0.003, 6, mat.ink, [s * 0.013, 0.021, z], [0, 0, -s * 0.75]);
    }
  });
}

/** Auspufftopf entlang z mit Hitzeschild (Lochband) und Endrohr / muffler along z with heat shield (perforated band) and tail pipe */
export function muffler(b: Builder, p: V3, len: number, r: number, c: ColorLike, tailDir: 1 | -1 = -1) {
  b.group({ p }, () => {
    b.cyl(r, r, len, 12, c, [0, 0, 0], [HALF_PI, 0, 0]);
    b.cyl(r * 1.02, r * 1.02, 0.004, 12, shade(c, 0.7), [0, 0, len * 0.5], [HALF_PI, 0, 0]);
    b.cyl(r * 1.02, r * 1.02, 0.004, 12, shade(c, 0.7), [0, 0, -len * 0.5], [HALF_PI, 0, 0]);
    // Hitzeschild oben mit Loechern / heat shield on top with holes
    b.add(geo.cbox(r * 1.7, 0.004, len * 0.78, 0.004), mat.metal, { p: [0, r + 0.003, 0] });
    for (let i = 0; i < 4; i++) for (const x of [-r * 0.4, r * 0.4]) b.box(0.0045, 0.002, 0.0045, mat.ink, [x, r + 0.0055, -len * 0.3 + i * len * 0.2]);
    b.cyl(r * 0.42, r * 0.42, 0.024, 8, mat.darkMid, [0, -r * 0.2, tailDir * (len / 2 + 0.012)], [HALF_PI, 0, 0]);
    b.cyl(r * 0.3, r * 0.3, 0.002, 8, mat.ink, [0, -r * 0.2, tailDir * (len / 2 + 0.024)], [HALF_PI, 0, 0]);
  });
}

/** Lueftungsgitter auf einer waagrechten Flaeche: Rahmen und Lamellen quer zu z / ventilation grille on a horizontal face: frame and slats across z */
export function grille(b: Builder, p: V3, w: number, d: number, n: number, frame: ColorLike, ry = 0) {
  b.group({ p, r: [0, ry, 0] }, () => {
    b.add(geo.cbox(w + 0.008, 0.004, d + 0.008, 0.004), frame, { p: [0, 0.002, 0] });
    b.box(w, 0.003, d, mat.ink, [0, 0.004, 0]);
    for (let i = 0; i < n; i++) b.box(w - 0.004, 0.004, d / n * 0.45, shade(frame, 0.85), [0, 0.0055, -d / 2 + (i + 0.5) * (d / n)], [0.35, 0, 0]);
    b.box(0.004, 0.005, d, frame, [0, 0.006, 0]);
  });
}

/** Ersatzkettenglieder auf einer Flaeche (lokal: Glieder quer zu z, Flaeche nach +y) / spare track links on a face (locally: links across z, face towards +y) */
export function spareLinks(b: Builder, p: V3, r: V3, n: number, w: number, c: ColorLike = mat.dark) {
  b.group({ p, r }, () => {
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 0.024;
      b.add(geo.cbox(w, 0.008, 0.019, 0.004), c, { p: [0, 0.004, z] });
      b.box(w * 0.18, 0.012, 0.008, mat.metal, [0, 0.006, z]);
      for (const s of [-1, 1]) b.box(0.006, 0.006, 0.008, mat.metal, [s * w * 0.42, 0.007, z]);
    }
    // Haltebolzen / retaining bolts
    for (const s of [-1, 1]) b.box(0.006, 0.01, n * 0.024, mat.darkMid, [s * (w / 2 + 0.004), 0.004, 0]);
  });
}

/** Haltegriffe (Bugel) auf einer senkrechten Flaeche entlang z / grab rail on a vertical face along z */
export function grabRail(b: Builder, x: number, y: number, z0: number, z1: number, out: number, c: ColorLike = mat.dark) {
  b.tube([x, y, z0], [x + out, y, z0], 0.0025, 4, c);
  b.tube([x + out, y, z0], [x + out, y, z1], 0.0025, 4, c);
  b.tube([x + out, y, z1], [x, y, z1], 0.0025, 4, c);
}

/** Antennenfuss mit Feder und Halteplatte / antenna base with spring and mount plate */
export function antennaBase(b: Builder, x: number, y: number, z: number, c: ColorLike = mat.dark) {
  b.add(geo.cbox(0.022, 0.006, 0.022, 0.004), c, { p: [x, y + 0.003, z] });
  b.cyl(0.006, 0.007, 0.016, 8, mat.darkMid, [x, y + 0.014, z]);
  for (let i = 0; i < 2; i++) b.add(geo.torus(0.0058, 0.0016, 3, 8), mat.metal, { p: [x, y + 0.01 + i * 0.005, z], r: [HALF_PI, 0, 0] });
}

// ---------- Laufwerk / running gear ----------

/**
 * Reiches Laufrad (Achse entlang x): Gummibandage mit runden Schultern, gewoelbte Radscheibe, Nabenkappe, Bolzenkranz.
 * Die Innenseite zur Wanne bleibt offen (unsichtbar). side = Richtung der Aussenseite (+1 / -1).
 * Rich road wheel (axle along x): rubber tyre with round shoulders, dished wheel disc, hub cap, bolt ring. The inner
 * face towards the hull stays open (invisible). side = direction of the outer face (+1 / -1).
 */
export function roadWheel(b: Builder, x: number, y: number, z: number, r: number, w: number, side: number, disc: ColorLike, hub: ColorLike, seg = 14) {
  const hw = w / 2;
  b.group({ p: [x, y, z], r: [0, 0, -side * HALF_PI] }, () => {
    // lokal: Achse = y, Aussenseite = +y / local: axle = y, outer face = +y
    b.add(lathe([[r * 0.8, -hw], [r, -hw * 0.5], [r, hw * 0.5], [r * 0.8, hw]], seg), mat.dark);
    b.add(lathe([[r * 0.82, -hw * 0.6, true], [r * 0.82, hw * 0.7, true], [r * 0.38, hw * 0.9, true], [r * 0.3, hw * 1.05], [0, hw * 1.05]], seg), disc);
    b.add(lathe([[r * 0.24, hw], [r * 0.24, hw * 1.45, true], [0, hw * 1.6]], 8), hub);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.box(0.0045, 0.004, 0.0045, mat.dark, [Math.sin(a) * r * 0.5, hw * 0.98, Math.cos(a) * r * 0.5]);
    }
  });
}

/**
 * Treibrad mit Zahnkranz und Nabe (Achse entlang x) / drive sprocket with a toothed ring and a hub (axle along x).
 */
export function sprocketWheel(b: Builder, x: number, y: number, z: number, r: number, w: number, side: number, c: ColorLike, hub: ColorLike, teeth = 10) {
  b.group({ p: [x, y, z], r: [0, 0, -side * HALF_PI] }, () => {
    b.add(drum(r * 0.84, r * 0.84, w * 0.8, 14), c);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      b.box(r * 0.22, w * 0.7, r * 0.26, c, [Math.sin(a) * r * 0.9, 0, Math.cos(a) * r * 0.9], [0, a, 0]);
    }
    b.add(drum(r * 0.6, r * 0.6, 0.002, 12), shade(c, 0.7), { p: [0, w * 0.41, 0] });
    b.add(lathe([[r * 0.34, w * 0.4], [r * 0.34, w * 0.6, true], [0, w * 0.7]], 10), hub);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.box(0.004, 0.004, 0.004, mat.dark, [Math.sin(a) * r * 0.47, w * 0.42, Math.cos(a) * r * 0.47]);
    }
  });
}

/** Leitrad mit Speichenscheibe (Achse entlang x) / idler wheel with a spoked disc (axle along x) */
export function idlerWheel(b: Builder, x: number, y: number, z: number, r: number, w: number, side: number, c: ColorLike, hub: ColorLike) {
  b.group({ p: [x, y, z], r: [0, 0, -side * HALF_PI] }, () => {
    b.add(lathe([[r * 0.78, -w * 0.4], [r, -w * 0.2], [r, w * 0.2], [r * 0.78, w * 0.4]], 14), c);
    b.add(drum(r * 0.8, r * 0.8, w * 0.3, 12), shade(c, 0.6));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      b.box(r * 0.16, w * 0.5, r * 0.72, c, [Math.sin(a) * r * 0.42, 0, Math.cos(a) * r * 0.42], [0, a, 0]);
    }
    b.add(lathe([[r * 0.28, w * 0.2], [r * 0.28, w * 0.5, true], [0, w * 0.62]], 8), hub);
  });
}

/** Stuetzrolle (Achse entlang x) / return roller (axle along x) */
export function returnRoller(b: Builder, x: number, y: number, z: number, r: number, w: number, side: number, c: ColorLike, hub: ColorLike) {
  b.add(drum(r, r, w, 10), c, { p: [x, y, z], r: [0, 0, HALF_PI] });
  b.add(drum(r * 0.5, r * 0.5, w + 0.006, 6), hub, { p: [x + side * 0.002, y, z], r: [0, 0, HALF_PI] });
  // Halter an der Wanne / bracket on the hull
  b.box(0.012, 0.006, 0.008, mat.dark, [x - side * (w / 2 + 0.006), y + r * 0.3, z]);
}

// ---------- Geschuetz / gun ----------

/**
 * Reiches Kanonenrohr (entlang +z, Laenge len, Radius r): Wiege-Ring, konischer Lauf, Rauchabsauger, Waermeschutz-Baender.
 * Rich gun barrel (along +z, length len, radius r): cradle collar, tapered tube, fume extractor, thermal sleeve bands.
 */
export function richBarrel(b: Builder, x: number, y: number, z0: number, len: number, r: number, c: ColorLike, sleeves: number, seg = 14) {
  // Profil entlang der Achse (lokal y = Laenge) / profile along the axis (local y = length)
  const ev = 0.52, evl = 0.11;
  const P: [number, number, boolean?][] = [
    [0, 0], [r * 1.22, 0, true], [r * 1.22, len * 0.06, true], [r * 1.12, len * 0.07, true],
    [r * 1.08, len * (ev - evl / 2) - 0.008], [r * 1.5, len * (ev - evl / 2) + 0.004], [r * 1.55, len * ev],
    [r * 1.5, len * (ev + evl / 2) - 0.004], [r * 1.02, len * (ev + evl / 2) + 0.008], [r * 0.98, len, true], [0, len],
  ];
  b.add(lathe(P.map(([a, c2, h]) => (h ? [a, c2, true] as const : [a, c2] as const)), seg), c, { p: [x, y, z0], r: [HALF_PI, 0, 0] });
  // Waermeschutz-Baender und Spannringe / thermal sleeve bands and clamp rings
  for (let i = 0; i < sleeves; i++) {
    const t = 0.24 + i * 0.12;
    b.cyl(r * 1.2, r * 1.2, 0.006, seg, shade(c, 0.72), [x, y, z0 + len * t], [HALF_PI, 0, 0]);
  }
  for (const t of [0.72, 0.86]) b.cyl(r * 1.13, r * 1.13, 0.005, seg, shade(c, 0.72), [x, y, z0 + len * t], [HALF_PI, 0, 0]);
}

/** Blende (Mantlet) mit Bolzen und Visieroeffnung, Front bei z / mantlet with bolts and sight aperture, front at z */
export function mantletBolts(b: Builder, x: number, y: number, z: number, w: number, h: number, c: ColorLike) {
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.cyl(0.0045, 0.0045, 0.006, 6, c, [x + sx * w * 0.38, y + sy * h * 0.32, z + 0.002], [HALF_PI, 0, 0]);
  b.add(geo.cbox(0.014, 0.012, 0.006, 0.003), mat.dark, { p: [x + w * 0.3, y + h * 0.1, z + 0.002] });
  b.box(0.008, 0.006, 0.004, mat.glassDark, [x + w * 0.3, y + h * 0.1, z + 0.005]);
}

// ---------- Maschinen und Roboter / machines and robots ----------

/**
 * Hydraulikzylinder von a nach c: Zylinder (60 %), Kolbenstange, Augen an beiden Enden.
 * Hydraulic ram from a to c: cylinder (60 %), piston rod, eyes at both ends.
 */
export function piston(b: Builder, a: V3, c: V3, r: number, body: ColorLike, rod: ColorLike = mat.metalLight) {
  const A = V(a), C = V(c);
  const M = A.clone().lerp(C, 0.6);
  b.segment(A, M, (len) => drum(r, r, len, 8), body);
  b.segment(M.clone().lerp(A, 0.05), C, (len) => drum(r * 0.5, r * 0.5, len, 6), rod);
  for (const p of [a, c]) b.add(geo.sphere(r * 0.9, 6, 4), mat.dark, { p });
}

/** Kabel mit Durchhang von a nach c in drei Stuecken / cable with sag from a to c in three pieces */
export function cable(b: Builder, a: V3, c: V3, sag: number, r: number, col: ColorLike) {
  const P = [0, 1 / 3, 2 / 3, 1].map((t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (c[2] - a[2]) * t] as V3);
  for (let i = 0; i < 3; i++) b.tube(P[i], P[i + 1], r, 5, col);
}

/**
 * Lueftungsschlitze: n Schlitze in einer Gruppe (lokal: Schlitze quer zu z, Flaeche nach +y).
 * Vent slots: n slots in a group (locally: slots across z, face towards +y).
 */
export function vents(b: Builder, p: V3, r: V3, n: number, w: number, pitch: number, col: ColorLike = mat.ink) {
  b.group({ p, r }, () => {
    for (let i = 0; i < n; i++) b.box(w, 0.003, 0.004, col, [0, 0.001, (i - (n - 1) / 2) * pitch]);
  });
}

/** Kuehlrippen um eine Achse entlang z (Ringe) / cooling fins around an axis along z (rings) */
export function finRings(b: Builder, x: number, y: number, z0: number, z1: number, n: number, r: number, col: ColorLike) {
  for (let i = 0; i < n; i++) {
    const z = z0 + (n === 1 ? 0.5 : i / (n - 1)) * (z1 - z0);
    b.add(drum(r, r, 0.004, 12), col, { p: [x, y, z], r: [HALF_PI, 0, 0] });
  }
}

/** Sensorgruppe: n kleine Linsen in einer Reihe (Blick +z) / sensor cluster: n small lenses in a row (facing +z) */
export function sensorCluster(b: Builder, p: V3, n: number, r: number, lens: ColorLike, ring: ColorLike = mat.dark) {
  for (let i = 0; i < n; i++) {
    const x = p[0] + (i - (n - 1) / 2) * r * 2.6;
    b.add(drum(r * 1.25, r * 1.25, 0.004, 8), ring, { p: [x, p[1], p[2]], r: [HALF_PI, 0, 0] });
    b.add(geo.sphere(r, 8, 4), lens, { p: [x, p[1], p[2] + 0.002], s: [1, 1, 0.6] });
  }
}
