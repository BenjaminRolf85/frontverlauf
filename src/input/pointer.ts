/**
 * Maus und Touch: tippen, ziehen, mit zwei Fingern zoomen, lange druecken, Mausrad.
 * Mouse and touch: tap, drag, pinch zoom, long press, wheel.
 * Jede Eingabe wird ueber den Controller zu einem Kommando an den Spielkern.
 */
import type { View } from '../render/view';

export interface PointerHandlers {
  tap: (clientX: number, clientY: number) => void;
  longPress: (clientX: number, clientY: number) => void;
}

const LONG_PRESS_MS = 520;
const DRAG_THRESHOLD = 8;

export function attachPointer(view: View, el: HTMLElement, h: PointerHandlers) {
  const pts = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  let dragging = false;
  let pinchDist = 0;
  let pinchZoom = 1;
  let longTimer: number | null = null;
  let longFired = false;

  const clearLong = () => { if (longTimer !== null) { clearTimeout(longTimer); longTimer = null; } };

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    longFired = false;
    if (pts.size === 1) {
      dragging = false;
      clearLong();
      longTimer = window.setTimeout(() => {
        if (!dragging && pts.size === 1) { longFired = true; h.longPress(e.clientX, e.clientY); }
      }, LONG_PRESS_MS);
    } else if (pts.size === 2) {
      clearLong();
      const [a, b] = [...pts.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchZoom = view.zoom;
      dragging = true;
    }
  });

  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 1) {
      if (!dragging && Math.hypot(p.x - p.sx, p.y - p.sy) > DRAG_THRESHOLD) { dragging = true; clearLong(); }
      if (dragging) view.pan(dx, dy);
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) view.setZoom(pinchZoom * (d / pinchDist));
    }
  });

  const end = (e: PointerEvent) => {
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    clearLong();
    if (!p) return;
    if (pts.size === 0 && !dragging && !longFired && e.type === 'pointerup') h.tap(e.clientX, e.clientY);
    if (pts.size === 0) dragging = false;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); h.longPress(e.clientX, e.clientY); });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.setZoom(view.zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
}
