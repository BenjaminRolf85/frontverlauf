/**
 * Gezeichnete Einheiten: Embleme der Fraktionen als Zeichnung (Formen aus emblems.ts).
 * Inked units: faction emblems as drawing (shapes from emblems.ts).
 *
 * Jede Fraktion hat im Atlas eine eigene Zelle 'emblem:<fraktion>' in ihrer Emblemfarbe; die Geometrie waehlt sie ueber
 * die UV aus. So bleibt die Textur fuer alle Fraktionen dieselbe.
 * Every faction has its own atlas cell 'emblem:<faction>' in its emblem colour; the geometry picks it by UV. The
 * texture thus stays the same for all factions.
 */
import { FACTION_IDS, type FactionId } from '../../../data/balance';
import { emblemShapes } from '../emblems';
import type { ColorLike } from '../kit';
import { look } from '../look';
import { css, type Cell, type Pen, type Pt } from './atlas';

/** Emblem um (cx, cy) mit Radius r zeichnen: Farbe deckend, Rand in Tusche / draw the emblem around (cx, cy) with radius r: opaque colour, ink rim */
export function paintEmblem(p: Pen, f: FactionId, cx: number, cy: number, r: number, c: ColorLike, rim = Math.max(1.3, r * 0.1)): void {
  const shapes = emblemShapes(f);
  const map = (v: { x: number; y: number }): Pt => [cx + v.x * r, cy - v.y * r];
  const ctx = p.abs;
  ctx.save();
  ctx.fillStyle = css(c);
  ctx.beginPath();
  const outlines: Pt[][] = [];
  for (const s of shapes) {
    for (const loop of [s.getPoints(6), ...s.holes.map((h) => h.getPoints(6))]) {
      const pts = loop.map(map);
      pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      outlines.push(pts);
    }
  }
  ctx.fill('evenodd');
  ctx.restore();
  if (rim > 0) for (const pts of outlines) p.line(pts, rim, { closed: true, wobble: 0.12, press: 0.15 });
}

/** Zellen 'emblem:<fraktion>' fuer alle Fraktionen / cells 'emblem:<faction>' for all factions */
export function emblemCells(size = 64): Cell[] {
  return FACTION_IDS.map((f): Cell => ({
    name: `emblem:${f}`, w: size, h: size, design: [64, 64],
    paint: (p) => paintEmblem(p, f, 32, 32, 25, look(f).emblem),
  }));
}
