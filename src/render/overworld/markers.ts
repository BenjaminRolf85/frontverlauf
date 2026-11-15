/**
 * Einsatzmarker auf den Scheiben: Stab mit Muenze am Boden und ein Comic-Abzeichen (Canvas-Sprite) mit Nummer,
 * Schloss oder Fragezeichen; gewonnene zeigen ihre Sterne, der offene pulsiert, gesperrte sind gedaempft. Dazwischen ein
 * gepunkteter Weg. Unsichtbare Trefferkugeln machen die Marker anklickbar.
 * Mission markers on the discs: a pole with a coin on the ground and a comic badge (canvas sprite) with number, lock
 * or question mark; won ones show their stars, the open one pulses, locked ones are dimmed. A dotted path in between.
 * Invisible hit spheres make the markers clickable.
 */
import * as THREE from 'three';
import { primitives, semantic } from '../../design/tokens';
import type { MarkerInfo, MarkerState } from '../../ui/overworldState';
import type { WorldId } from '../../core/worlds';
import { Builder, geo } from '../models/kit';
import { canvasTexture, place, type Look } from './kit';

/**
 * Kartennadel je Welt (Ursprung am Boden, Hoehe etwa 0.2): Erde = Wimpel an einem Stab mit Sandsaecken,
 * Alienwelt = Kristallsplitter ueber einem Sockel, Vergessene = Steinpfahl mit Banner (rot-weisser Saum).
 * Map pin per world (origin on the ground, about 0.2 tall): Earth = pennant on a pole with sandbags,
 * alien world = crystal shard above a socket, Forgotten = stone stake with a banner (red and white hem).
 */
export function pinGeometry(world: WorldId, colour: string): THREE.BufferGeometry {
  const b = new Builder();
  if (world === 'alien') {
    b.add(geo.cyl(0.05, 0.06, 0.025, 8), semantic.alienRockDark, { p: [0, 0.012, 0] });
    b.add(geo.cyl(0.006, 0.008, 0.1, 5), semantic.alienMoss, { p: [0, 0.07, 0] });
    b.add(geo.cone(0.035, 0.07, 4), colour, { p: [0, 0.155, 0] });
    b.add(geo.cone(0.035, 0.045, 4), colour, { p: [0, 0.098, 0], r: [Math.PI, 0, 0] });
  } else if (world === 'forgotten') {
    b.add(geo.box(0.07, 0.02, 0.07), semantic.verdanStoneDark, { p: [0, 0.01, 0] });
    b.add(geo.taper(0.022, 0.022, 0.014, 0.014, 0.2, 0), semantic.verdanStone, { p: [0, 0.11, 0] });
    b.add(geo.box(0.09, 0.008, 0.008), semantic.verdanStoneDark, { p: [0, 0.19, 0.012] });
    b.add(geo.box(0.07, 0.085, 0.004), colour, { p: [0, 0.14, 0.016] });
    b.add(geo.box(0.07, 0.012, 0.005), semantic.verdanWhite, { p: [0, 0.098, 0.017] });
    b.add(geo.box(0.07, 0.006, 0.005), semantic.verdanRed, { p: [0, 0.09, 0.017] });
  } else {
    for (let i = 0; i < 3; i++) b.add(geo.rbox(0.032, 0.016, 0.02, 0.005), i % 2 ? semantic.dust : semantic.beach, { p: [Math.cos(i * 2.1) * 0.025, 0.008, Math.sin(i * 2.1) * 0.025], r: [0, i * 2.1, 0] });
    b.add(geo.cyl(0.005, 0.006, 0.22, 5), semantic.timber, { p: [0, 0.11, 0] });
    b.add(geo.profileXY([[0, 0], [0.085, 0.025], [0, 0.05]], 0.006), colour, { p: [0.004, 0.16, 0] });
    b.add(geo.sphere(0.009, 5, 4), semantic.accentStrong, { p: [0, 0.222, 0] });
  }
  return b.build();
}

const STATE_COLOUR: Record<MarkerState, string> = {
  won: semantic.overworldMarkerWon, available: semantic.overworldMarkerOpen, locked: semantic.overworldMarkerLocked, coming: semantic.overworldMarkerComing,
};

const BADGE_W = 128, BADGE_H = 168;

/** Stern als Pfad / star as a path */
function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Abzeichen zeichnen / draw a badge */
export function drawBadge(ctx: CanvasRenderingContext2D, m: MarkerInfo) {
  ctx.clearRect(0, 0, BADGE_W, BADGE_H);
  const cx = 64, cy = 62, r = m.finale ? 52 : 46;
  ctx.lineJoin = 'round';
  // harter Comic-Schatten / hard comic shadow
  ctx.fillStyle = semantic.ink;
  ctx.beginPath(); ctx.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); ctx.fill();
  if (m.finale) {
    ctx.fillStyle = semantic.artifactGlow;
    ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = STATE_COLOUR[m.state];
  ctx.strokeStyle = semantic.ink;
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = m.state === 'won' ? semantic.textInverse : semantic.ink;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (m.state === 'locked') {
    // Schloss / lock
    ctx.fillStyle = semantic.textInverse;
    ctx.strokeStyle = semantic.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy - 8, 13, Math.PI, 0); ctx.lineWidth = 7; ctx.strokeStyle = semantic.textInverse; ctx.stroke();
    ctx.fillRect(cx - 19, cy - 6, 38, 28);
    ctx.fillStyle = semantic.ink; ctx.fillRect(cx - 3, cy + 2, 6, 11);
  } else {
    ctx.font = `${m.state === 'coming' ? 58 : 56}px ${primitives.font.display}`;
    const label = m.state === 'coming' ? '?' : String(m.no);
    ctx.lineWidth = 6; ctx.strokeStyle = m.state === 'won' ? semantic.ink : semantic.textInverse;
    ctx.strokeText(label, cx, cy + 3);
    ctx.fillText(label, cx, cy + 3);
  }
  if (m.state === 'won') {
    for (let i = 0; i < 3; i++) {
      starPath(ctx, 28 + i * 36, 138, 17);
      ctx.fillStyle = i < m.stars ? semantic.accentStrong : semantic.neutral;
      ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = semantic.ink; ctx.stroke();
    }
  }
}

export interface MarkerSet {
  group: THREE.Group;
  /** Trefferkugeln mit userData.missionId / hit spheres with userData.missionId */
  hits: THREE.Mesh[];
  /** Weltposition eines Markers (Abzeichen) / world position of a marker (badge) */
  anchor(id: string): THREE.Object3D | undefined;
  update(t: number): void;
  /** Abzeichen neu zeichnen (Schrift geladen) / redraw badges (font loaded) */
  redraw(): void;
}

export function buildMarkers(look: Look, list: readonly MarkerInfo[], spots: readonly THREE.Vector2[], heightAt: (x: number, z: number) => number, opts: { scale: number; world: WorldId }): MarkerSet {
  const group = new THREE.Group();
  const hits: THREE.Mesh[] = [];
  const anchors = new Map<string, THREE.Object3D>();
  const textures: { tex: THREE.CanvasTexture; m: MarkerInfo }[] = [];
  const bobbing: THREE.Object3D[] = [];
  const rings: THREE.Mesh[] = [];
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const s = opts.scale;
  const ringMat = look.glow(semantic.overworldMarkerOpen, 1.7, { additive: true, opacity: 0.9 });
  list.forEach((m, i) => {
    const p = spots[i];
    if (!p) return;
    const y = heightAt(p.x, p.y);
    const root = new THREE.Group();
    root.position.set(p.x, y, p.y);
    group.add(root);
    // Kartennadel der Welt in der Zustandsfarbe / the world's map pin in the state colour
    const pin = look.inked(pinGeometry(opts.world, STATE_COLOUR[m.state]), 0.005);
    pin.scale.setScalar(s);
    root.add(pin);
    // Abzeichen / badge
    const canvas = { tex: canvasTexture(BADGE_W, BADGE_H, (ctx) => drawBadge(ctx, m)), m };
    textures.push(canvas);
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvas.tex, transparent: true, depthWrite: false, opacity: m.state === 'locked' || m.state === 'coming' ? 0.82 : 1 }));
    const bw = (m.finale ? 0.36 : 0.3) * s;
    badge.scale.set(bw, bw * (BADGE_H / BADGE_W), 1);
    badge.center.set(0.5, 0.08);
    badge.position.y = 0.23 * s;
    badge.renderOrder = 5;
    badge.raycast = () => {};
    root.add(badge);
    anchors.set(m.id, badge);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 8, 6), hitMat);
    hit.position.y = 0.32 * s;
    hit.userData.missionId = m.id;
    root.add(hit);
    hits.push(hit);
    if (m.state === 'available') {
      bobbing.push(badge);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1 * s, 0.135 * s, 28), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      ring.raycast = () => {};
      root.add(ring);
      rings.push(ring);
    }
  });
  // --- gepunkteter Weg / dotted path ---
  const bright: THREE.Matrix4[] = [], dim: THREE.Matrix4[] = [];
  for (let i = 0; i < Math.min(list.length, spots.length) - 1; i++) {
    const a = spots[i], b = spots[i + 1];
    const len = a.distanceTo(b);
    const n = Math.floor(len / 0.075);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (t * len < 0.11 || (1 - t) * len < 0.11) continue;
      // leichte Kurve / slight curve
      const bend = Math.sin(t * Math.PI) * 0.06 * (i % 2 ? 1 : -1);
      const x = a.x + (b.x - a.x) * t - (b.y - a.y) / len * bend, z = a.y + (b.y - a.y) * t + (b.x - a.x) / len * bend;
      (list[i].state === 'won' ? bright : dim).push(place(x, heightAt(x, z) + 0.008, z, 0, 1));
    }
  }
  const dot = () => new THREE.CylinderGeometry(0.017, 0.017, 0.012, 6);
  if (bright.length) group.add(look.instanced(dot(), bright, 0.008, look.flat(semantic.overworldPath)));
  if (dim.length) group.add(look.instanced(dot(), dim, 0, look.flat(semantic.overworldMarkerLocked)));
  return {
    group, hits,
    anchor: (id) => anchors.get(id),
    update(t) {
      const k = (t * 0.9) % 1;
      for (const r of rings) r.scale.setScalar(1 + k * 1.1);
      ringMat.opacity = 0.9 * (1 - k);
      for (const b of bobbing) { b.position.y = 0.23 * s + Math.sin(t * 3) * 0.02; b.scale.x = b.scale.y * (BADGE_W / BADGE_H) * (1 + Math.sin(t * 6) * 0.03); }
    },
    redraw() {
      for (const c of textures) { const ctx = (c.tex.image as HTMLCanvasElement).getContext('2d'); if (ctx) { drawBadge(ctx, c.m); c.tex.needsUpdate = true; } }
    },
  };
}
