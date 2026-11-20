/**
 * Lagekarte: kleine Canvas-Uebersicht der ganzen Karte aus Sicht des Betrachters, gedreht wie die Hauptansicht.
 * Nebel, Gelaende, Gebiete, Staedte, Einheiten und der sichtbare Kameraausschnitt. Antippen bewegt die Kamera.
 * Overview map: small canvas of the whole map from the viewer's perspective, rotated like the main view.
 * Fog, terrain, territories, cities, units and the visible camera area. Tapping moves the camera.
 *
 * Gezeichnet als kleine Papierkarte im Comic-Stil: Papierton und Rahmen aus den Tokens, Gelaende wie gedruckt (zum
 * Papier hin gemischt), Kuesten als Tuschelinie, Unerforschtes als schraffiertes leeres Papier. Staedte sind Kreise,
 * Hauptquartiere Sterne, Sendetuerme Dreiecke in Fraktionsfarbe mit Tuscherand. Das Grundbild (Gelaende, Kuesten,
 * Grenzen, Schraffur) entsteht nur bei einer Aenderung des Spielstands; Kamerabewegungen zeichnen es bloss neu ein.
 * Drawn as a small paper map in the comic style: paper tone and frame from the tokens, terrain as if printed (mixed
 * towards the paper), coasts as an ink line, the unexplored as hatched blank paper. Cities are circles, headquarters
 * stars, transmitter towers triangles in the faction colour with an ink rim. The base image (terrain, coasts, borders,
 * hatching) is only built when the game state changes; camera moves merely draw it again.
 */
import * as THREE from 'three';
import { factionTokens, components, semantic } from '../design/tokens';
import { canSeeUnit, cityById, isExplored, type GameState, type Tile } from '../core';
import type { Controller } from '../game/controller';
import { t } from '../i18n/i18n';
import { icon } from './icons';

const MM = components.minimap;
const STORE_KEY = 'frontverlauf.minimap.v1';
/** kleinster Abstand zwischen zwei Zeichnungen in ms / minimum time between two draws in ms */
const THROTTLE_MS = 60;
/** Pixel je Feld im Grundbild / pixels per tile in the base image */
const BASE_PX = 12;
const css = ([r, g, b]: Rgb) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const isWater = (tile: Tile) => tile.terrain === 'ocean' || tile.terrain === 'shallow';

type Rgb = [number, number, number];
/** Token-Farbe (#rrggbb) in RGB / token colour (#rrggbb) to RGB */
function rgb(color: string): Rgb {
  const n = parseInt(color.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

const BIOME_COLOR: Record<string, string> = {
  desert: semantic.biomeDesert, steppe: semantic.biomeSteppe, tundra: semantic.biomeTundra, swamp: semantic.biomeSwamp,
  jungle: semantic.biomeJungle, hills: semantic.biomeHills,
};

/** Grundfarbe eines Feldes / base colour of a tile */
function tileColor(tile: Tile): string {
  if (tile.lava) return MM.lava;
  switch (tile.terrain) {
    case 'ocean': return MM.ocean;
    case 'shallow': return MM.shallow;
    case 'mountain': return MM.mountain;
    case 'forest': return MM.forest;
    default:
      if (tile.xeno) return MM.xeno;
      return (tile.biome && BIOME_COLOR[tile.biome]) || MM.plain;
  }
}

function loadCollapsed(): boolean {
  try { return localStorage.getItem(STORE_KEY) === 'collapsed'; } catch { return false; }
}
function saveCollapsed(on: boolean) {
  try { localStorage.setItem(STORE_KEY, on ? 'collapsed' : 'open'); } catch { /* nichts / nothing */ }
}

export class Minimap {
  private readonly wrap: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly toggleBtn: HTMLButtonElement;
  private readonly base = document.createElement('canvas');
  private collapsed = loadCollapsed();
  private shown = false;
  private dirty = true;
  private camKey = '';
  private lastDraw = 0;
  private raf = 0;
  private dragging = false;
  private lang = '';
  /** Kamera-Basis am Boden: rechts und vorwaerts / camera basis on the ground: right and forward */
  private right = new THREE.Vector2(1, 0);
  private fwd = new THREE.Vector2(0, -1);
  private scale = 1;

  constructor(private root: HTMLElement, private game: Controller, private visible: () => boolean) {
    this.wrap = document.createElement('div');
    this.wrap.className = 'minimap';
    this.wrap.setAttribute('role', 'region');
    this.wrap.hidden = true;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap-canvas';
    this.canvas.setAttribute('role', 'img');
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.className = 'icon-btn minimap-toggle';
    this.wrap.append(this.canvas, this.toggleBtn);
    root.appendChild(this.wrap);
    this.toggleBtn.addEventListener('click', () => this.setCollapsed(!this.collapsed));
    this.canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* aeltere Browser / older browsers */ }
      this.jump(e.clientX, e.clientY);
      e.preventDefault();
    });
    this.canvas.addEventListener('pointermove', (e) => { if (this.dragging) this.jump(e.clientX, e.clientY); });
    const stop = () => { this.dragging = false; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
    // Abstand ueber der Aktionsleiste (Hochformat) folgt deren Hoehe / lift above the action bar (portrait) follows its height
    const bottom = root.querySelector<HTMLElement>('.bottom');
    if (bottom && typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.updateLift(bottom)).observe(bottom);
    this.applyCollapsed();
    this.loop();
  }

  /** nach Kommandos, Zuegen und Neuaufbau / after commands, turns and rebuilds */
  invalidate() { this.dirty = true; }

  private updateLift(bottom: HTMLElement) {
    this.wrap.style.setProperty('--minimap-lift', `${Math.round(bottom.getBoundingClientRect().height)}px`);
  }

  private setCollapsed(on: boolean) {
    this.collapsed = on;
    saveCollapsed(on);
    this.game.play('click');
    this.applyCollapsed();
    this.dirty = true;
  }

  private applyCollapsed() {
    this.wrap.classList.toggle('collapsed', this.collapsed);
    this.canvas.hidden = this.collapsed;
    this.lang = '';
    this.updateLabels();
  }

  private updateLabels() {
    const key = `${t('minimap.hint')}|${this.collapsed}`;
    if (key === this.lang) return;
    this.lang = key;
    const label = this.collapsed ? t('minimap.show') : t('minimap.hide');
    this.toggleBtn.innerHTML = icon(this.collapsed ? 'map' : 'minus');
    this.toggleBtn.setAttribute('aria-label', label);
    this.toggleBtn.title = label;
    this.toggleBtn.setAttribute('aria-expanded', String(!this.collapsed));
    this.canvas.setAttribute('aria-label', t('minimap.hint'));
    this.canvas.title = t('minimap.label');
    this.wrap.setAttribute('aria-label', t('minimap.label'));
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const view = this.game.view;
    const s = this.game.state;
    // nicht im Menue und nie in XR / not in the menu and never in XR
    const show = !!s && this.visible() && !view.renderer.xr.isPresenting;
    if (show !== this.shown) {
      this.shown = show;
      this.wrap.hidden = !show;
      if (show) { this.dirty = true; const b = this.root.querySelector<HTMLElement>('.bottom'); if (b) this.updateLift(b); }
    }
    if (!show || !s) return;
    this.updateLabels();
    if (this.collapsed) return;
    const now = performance.now();
    if (now - this.lastDraw < THROTTLE_MS) return;
    const dir = view.camera.getWorldDirection(new THREE.Vector3());
    const key = `${view.target.x.toFixed(2)},${view.target.z.toFixed(2)},${view.zoom.toFixed(3)},${dir.x.toFixed(3)},${dir.z.toFixed(3)},${this.canvas.clientWidth}`;
    if (!this.dirty && key === this.camKey) return;
    this.camKey = key;
    this.lastDraw = now;
    const rebuild = this.dirty;
    this.dirty = false;
    this.draw(s, rebuild);
  };

  /** Weltpunkt (x, z) auf die Lagekarte in CSS-Pixeln / world point (x, z) to the minimap in CSS pixels */
  private toMap(wx: number, wz: number, w: number, h: number): [number, number] {
    const k = this.scale;
    return [w / 2 + k * (wx * this.right.x + wz * this.right.y), h / 2 - k * (wx * this.fwd.x + wz * this.fwd.y)];
  }

  /** Feld unter einem Punkt der Lagekarte / tile under a point of the minimap */
  private pick(clientX: number, clientY: number): { x: number; y: number } | null {
    const s = this.game.state;
    if (!s) return null;
    const r = this.canvas.getBoundingClientRect();
    const u = (clientX - r.left - r.width / 2) / this.scale;
    const v = -(clientY - r.top - r.height / 2) / this.scale;
    const wx = u * this.right.x + v * this.fwd.x;
    const wz = u * this.right.y + v * this.fwd.y;
    const n = s.size;
    const x = Math.floor(wx + n / 2), y = Math.floor(wz + n / 2);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  }

  private jump(clientX: number, clientY: number) {
    const s = this.game.state;
    const p = this.pick(clientX, clientY);
    if (!s || !p) return;
    const view = this.game.view;
    view.centerOn(view.board.tileCenter(s, p.x, p.y));
  }

  /**
   * Grundbild, BASE_PX Pixel je Feld: gedrucktes Gelaende, Gebiete, Kuesten, Grenzen; Unerforschtes deckend als
   * schraffiertes Papier (nichts vom Gelaende darunter scheint durch, auch keine Kuestenlinie zum Unerforschten hin).
   * Base image, BASE_PX pixels per tile: printed terrain, territories, coasts, borders; the unexplored opaque as hatched
   * paper (nothing of the terrain below shows through, and no coast line towards the unexplored either).
   */
  private buildBase(s: GameState, viewer: number) {
    const n = s.size, P = BASE_PX;
    if (this.base.width !== n * P) { this.base.width = n * P; this.base.height = n * P; }
    const ctx = this.base.getContext('2d');
    if (!ctx) return;
    const paper = rgb(MM.bg);
    const mixK = parseFloat(MM.territoryMix), paperK = parseFloat(MM.paperMix);
    const seen = (x: number, y: number) => viewer < 0 || isExplored(s, viewer, x, y);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = MM.fog;
    ctx.fillRect(0, 0, n * P, n * P);
    const fog = new Path2D(), coast = new Path2D();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!seen(x, y)) { fog.rect(x * P, y * P, P, P); continue; }
        const tile = s.tiles[y * n + x];
        let c = mix(rgb(tileColor(tile)), paper, paperK);
        const owner = this.ownerOf(s, tile);
        if (owner !== null) c = mix(c, rgb(factionTokens[s.factions[owner].id].primary), mixK);
        ctx.fillStyle = css(c);
        ctx.fillRect(x * P, y * P, P, P);
        // Kueste nur zwischen zwei erforschten Feldern / coast only between two explored tiles
        if (isWater(tile)) continue;
        if (inside(x + 1, y) && seen(x + 1, y) && isWater(s.tiles[y * n + x + 1])) { coast.moveTo((x + 1) * P, y * P); coast.lineTo((x + 1) * P, (y + 1) * P); }
        if (inside(x - 1, y) && seen(x - 1, y) && isWater(s.tiles[y * n + x - 1])) { coast.moveTo(x * P, y * P); coast.lineTo(x * P, (y + 1) * P); }
        if (inside(x, y + 1) && seen(x, y + 1) && isWater(s.tiles[(y + 1) * n + x])) { coast.moveTo(x * P, (y + 1) * P); coast.lineTo((x + 1) * P, (y + 1) * P); }
        if (inside(x, y - 1) && seen(x, y - 1) && isWater(s.tiles[(y - 1) * n + x])) { coast.moveTo(x * P, y * P); coast.lineTo((x + 1) * P, y * P); }
      }
    }
    // Schraffur des Unerforschten / hatching of the unexplored
    ctx.save();
    ctx.clip(fog);
    ctx.strokeStyle = MM.fogHatch;
    ctx.lineWidth = P * 0.14;
    ctx.beginPath();
    for (let d = -n * P; d < n * P; d += P * 0.5) { ctx.moveTo(d, 0); ctx.lineTo(d + n * P, n * P); }
    ctx.stroke();
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.globalAlpha = parseFloat(MM.coastAlpha);
    ctx.strokeStyle = MM.outline;
    ctx.lineWidth = P * 0.16;
    ctx.stroke(coast);
    // Gebietsgrenzen in Fraktionsfarbe / territory borders in the faction colour
    ctx.globalAlpha = parseFloat(MM.borderAlpha);
    ctx.lineWidth = P * 0.2;
    const ownerAt = (x: number, y: number) => (inside(x, y) ? this.ownerOf(s, s.tiles[y * n + x]) : null);
    const byFaction = new Map<number, Path2D>();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const o = ownerAt(x, y);
        if (o === null || !seen(x, y)) continue;
        let p = byFaction.get(o);
        if (!p) { p = new Path2D(); byFaction.set(o, p); }
        if (ownerAt(x - 1, y) !== o) { p.moveTo(x * P, y * P); p.lineTo(x * P, (y + 1) * P); }
        if (ownerAt(x + 1, y) !== o) { p.moveTo((x + 1) * P, y * P); p.lineTo((x + 1) * P, (y + 1) * P); }
        if (ownerAt(x, y - 1) !== o) { p.moveTo(x * P, y * P); p.lineTo((x + 1) * P, y * P); }
        if (ownerAt(x, y + 1) !== o) { p.moveTo(x * P, (y + 1) * P); p.lineTo((x + 1) * P, (y + 1) * P); }
      }
    }
    for (const [o, p] of byFaction) { ctx.strokeStyle = factionTokens[s.factions[o].id].primary; ctx.stroke(p); }
    ctx.globalAlpha = 1;
  }

  private ownerOf(s: GameState, tile: Tile): number | null {
    if (tile.territory === null) return null;
    return cityById(s, tile.territory)?.owner ?? null;
  }

  private draw(s: GameState, rebuild: boolean) {
    const view = this.game.view;
    const viewer = this.game.viewer;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    if (rebuild || this.base.width !== s.size * BASE_PX) this.buildBase(s, viewer);
    // Kamera-Basis am Boden / camera basis on the ground
    const d = view.camera.getWorldDirection(new THREE.Vector3());
    const len = Math.hypot(d.x, d.z) || 1;
    this.fwd.set(d.x / len, d.z / len);
    this.right.set(-this.fwd.y, this.fwd.x);
    const n = s.size;
    const pad = parseFloat(MM.pad);
    this.scale = (Math.min(cw, ch) - pad * 2) / (n * Math.SQRT2);
    const k = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    // Gitterpunkt (gx, gy) -> Lagekarte: affine Abbildung / grid point (gx, gy) -> minimap: affine map
    const a = k * this.right.x, c = k * this.right.y, b = -k * this.fwd.x, dd = -k * this.fwd.y;
    const e = cw / 2 - (a + c) * n / 2, f = ch / 2 - (b + dd) * n / 2;
    ctx.setTransform(a * dpr, b * dpr, c * dpr, dd * dpr, e * dpr, f * dpr);
    // Schlagschatten des Kartenblatts, dann das Grundbild / drop shadow of the map sheet, then the base image
    ctx.fillStyle = MM.sheetShade;
    ctx.fillRect(0.35, 0.35, n, n);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, n, n);
    // Umriss der Karte / map outline
    ctx.lineWidth = parseFloat(MM.sheetLine) / k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = MM.outline;
    ctx.strokeRect(0, 0, n, n);
    const seen = (x: number, y: number) => viewer < 0 || isExplored(s, viewer, x, y);
    // Marker in Bildschirmpixeln / markers in screen pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // gedruckter Blattrand / printed sheet frame
    const inset = parseFloat(MM.frameInset);
    ctx.lineWidth = 1;
    ctx.strokeStyle = MM.frame;
    ctx.strokeRect(inset + 0.5, inset + 0.5, cw - inset * 2 - 1, ch - inset * 2 - 1);
    const off = (n - 1) / 2;
    const at = (x: number, y: number) => this.toMap(x - off, y - off, cw, ch);
    const ur = parseFloat(MM.unitDot);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = MM.outline;
    // Staedte zuerst: Kreis, Hauptquartier als Stern, Sendeturm als Dreieck / cities first: circle, HQ as a star, tower as a triangle
    const cr = parseFloat(MM.cityDot), hr = parseFloat(MM.hqDot);
    for (const city of s.cities) {
      if (!seen(city.x, city.y)) continue;
      const [mx, my] = at(city.x, city.y);
      const hq = city.isHQ && city.owner !== null && city.hqOf === city.owner;
      ctx.fillStyle = city.owner === null ? MM.neutral : factionTokens[s.factions[city.owner].id].primary;
      ctx.lineWidth = parseFloat(MM.markLine);
      ctx.beginPath();
      if (hq) {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? hr * 0.46 : hr;
          ctx.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r);
        }
        ctx.closePath();
      } else if (city.tower) {
        ctx.moveTo(mx, my - cr * 1.15); ctx.lineTo(mx + cr, my + cr * 0.8); ctx.lineTo(mx - cr, my + cr * 0.8); ctx.closePath();
      } else ctx.arc(mx, my, city.owner === null ? cr * 0.8 : cr, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // Einheiten darueber: kleiner Punkt, in einer Stadt bleibt deren Marke als Ring sichtbar
    // units on top: a small dot, inside a city its mark stays visible as a ring
    ctx.lineWidth = 1;
    for (const u of s.units) {
      if (viewer >= 0 && !canSeeUnit(s, viewer, u)) continue;
      const [mx, my] = at(u.x, u.y);
      const ft = factionTokens[s.factions[u.owner].id];
      ctx.fillStyle = u.owner === viewer ? ft.marker : ft.primary;
      ctx.beginPath();
      ctx.arc(mx, my, ur, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    // sichtbarer Kameraausschnitt / visible camera area
    const poly = this.viewPolygon(cw, ch);
    if (poly.length === 4) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, cw, ch);
      ctx.clip();
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.lineWidth = parseFloat(MM.viewLine) + 2;
      ctx.strokeStyle = MM.viewShade;
      ctx.stroke();
      ctx.lineWidth = parseFloat(MM.viewLine);
      ctx.strokeStyle = MM.view;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Ecken des Bildausschnitts auf dem Boden / corners of the visible area on the ground */
  private viewPolygon(cw: number, ch: number): [number, number][] {
    const view = this.game.view;
    const r = view.canvas.getBoundingClientRect();
    // nur der freie Bereich zwischen Statusleiste und Aktionsleiste / only the free area between top bar and action bar
    const bar = this.root.querySelector<HTMLElement>('.top-bar');
    const bottom = this.root.querySelector<HTMLElement>('.bottom');
    let y0 = r.top, y1 = r.bottom;
    if (bar && !bar.hidden) y0 = Math.max(y0, bar.getBoundingClientRect().bottom);
    if (bottom && !bottom.hidden) y1 = Math.min(y1, bottom.getBoundingClientRect().top);
    if (y1 - y0 < r.height * 0.2) { y0 = r.top; y1 = r.bottom; }
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const out: [number, number][] = [];
    const hit = new THREE.Vector3();
    for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const ray = view.raycaster(r.left + sx * r.width, y0 + sy * (y1 - y0));
      if (!ray.ray.intersectPlane(ground, hit)) return [];
      out.push(this.toMap(hit.x, hit.z, cw, ch));
    }
    return out;
  }

  dispose() { cancelAnimationFrame(this.raf); this.wrap.remove(); }
}
