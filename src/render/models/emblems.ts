/**
 * Fraktionsembleme als flache Formen (frei erfunden, ohne reale Vorbilder).
 * Faction emblems as flat shapes (invented, no real-world models).
 * Korvat: Zahnrad / gear; Dravon: abstrakte Blockfaust / abstract blocky fist;
 * Alvenia: Stern im Ring / star in a ring; Meridon: Kompassrose / compass rose; Velkar: Sechseck / hexagon.
 * Groesse: Radius 1, zentriert in XY / size: radius 1, centred in XY.
 */
import * as THREE from 'three';
import type { FactionId } from '../../data/balance';
import { Builder, geo, type ColorLike, type Xf } from './kit';

function poly(pts: [number, number][]): THREE.Shape {
  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
}
function circlePts(r: number, n: number, rot = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}
function hole(pts: [number, number][]): THREE.Path {
  return new THREE.Path(pts.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y)));
}
function starPts(points: number, ro: number, ri: number, rot = Math.PI / 2): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? ro : ri;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}
function rect(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  return poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
}

export function emblemShapes(f: FactionId): THREE.Shape[] {
  switch (f) {
    case 'korvat': {
      // Zahnrad mit 8 Zaehnen / gear with 8 teeth
      const pts: [number, number][] = [];
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * Math.PI * 2;
        const step = (Math.PI * 2) / teeth;
        const seq: [number, number][] = [[0.12, 0.74], [0.24, 1], [0.5, 1], [0.62, 0.74]];
        for (const [t, r] of seq) pts.push([Math.cos(a0 + t * step) * r, Math.sin(a0 + t * step) * r]);
      }
      const s = poly(pts);
      s.holes.push(hole(circlePts(0.32, 8)));
      return [s];
    }
    case 'dravon': {
      // Blockfaust von vorn: vier Fingerbloecke, Daumenbalken, Handgelenk / blocky fist front view
      const out: THREE.Shape[] = [];
      for (let i = 0; i < 4; i++) {
        const x0 = -0.8 + i * 0.41;
        out.push(rect(x0, 0.05, x0 + 0.37, 0.8 - (i === 0 || i === 3 ? 0.1 : 0)));
      }
      out.push(rect(-0.8, -0.25, 0.42, 0.01));
      out.push(poly([[0.42, -0.25], [0.84, -0.05], [0.84, 0.4], [0.46, 0.4], [0.46, 0.01]]));
      out.push(rect(-0.6, -0.95, 0.5, -0.3));
      return out;
    }
    case 'alvenia': {
      const ring = poly(circlePts(1, 12));
      ring.holes.push(hole(circlePts(0.8, 12)));
      return [ring, poly(starPts(5, 0.72, 0.3))];
    }
    case 'meridon': {
      // Kompassrose: 4 lange, 4 kurze Spitzen / compass rose: 4 long, 4 short points
      const pts: [number, number][] = [];
      for (let i = 0; i < 16; i++) {
        const a = Math.PI / 2 + (i / 16) * Math.PI * 2;
        const r = i % 2 === 1 ? 0.17 : i % 4 === 0 ? 1 : 0.55;
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return [poly(pts)];
    }
    case 'velkar': {
      const outer = poly(circlePts(1, 6, Math.PI / 2));
      outer.holes.push(hole(circlePts(0.68, 6, Math.PI / 2)));
      return [outer, poly(circlePts(0.38, 6, Math.PI / 2))];
    }
  }
}

/**
 * Emblem in XY (Blick +z), Radius `size`, Dicke `depth` / emblem in XY facing +z.
 */
export function addEmblem(b: Builder, f: FactionId, size: number, depth: number, c: ColorLike, xf: Xf = {}): void {
  b.group(xf, () => {
    b.add(geo.shapes(emblemShapes(f), depth / size), c, { s: [size, size, size] });
  });
}
