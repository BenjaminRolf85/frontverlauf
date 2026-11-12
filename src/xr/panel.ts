/**
 * Panels im Raum: Canvas-Texturen aus denselben Design-Tokens und Sprachdateien wie die HTML-Oberflaeche.
 * Panels in space: canvas textures built from the same design tokens and language files as the HTML UI.
 */
import * as THREE from 'three';
import { components, primitives, semantic } from '../design/tokens';

export interface PanelButton { id: string; x: number; y: number; w: number; h: number; enabled: boolean }

const PX_PER_M = 2000;

export class Panel {
  readonly mesh: THREE.Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  buttons: PanelButton[] = [];
  hover: string | null = null;

  constructor(readonly widthM: number, readonly heightM: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(widthM * PX_PER_M);
    this.canvas.height = Math.round(heightM * PX_PER_M);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
    this.mesh.userData.panel = this;
    this.mesh.renderOrder = 20;
  }

  get W() { return this.canvas.width; }
  get H() { return this.canvas.height; }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /** Hintergrund im Comic-Stil / comic-style background */
  begin(title?: string) {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);
    this.buttons = [];
    c.fillStyle = semantic.ink;
    this.rr(14, 14, this.W - 18, this.H - 18, 36); c.fill();
    c.fillStyle = components.panel.bg;
    this.rr(4, 4, this.W - 18, this.H - 18, 36); c.fill();
    c.lineWidth = 8; c.strokeStyle = semantic.ink; c.stroke();
    if (title) this.text(title, 40, 70, 64, semantic.text, 'display');
  }

  text(s: string, x: number, y: number, size: number, color: string = semantic.text, font: 'display' | 'body' = 'body', align: CanvasTextAlign = 'left', maxW?: number) {
    const c = this.ctx;
    c.font = `${font === 'display' ? '' : 'bold '}${size}px ${font === 'display' ? primitives.font.display : primitives.font.body}`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle';
    c.fillText(s, x, y, maxW);
  }

  button(id: string, label: string, x: number, y: number, w: number, h: number, opts: { enabled?: boolean; variant?: 'primary' | 'secondary' | 'danger'; sub?: string } = {}) {
    const c = this.ctx;
    const enabled = opts.enabled !== false;
    const bg = opts.variant === 'danger' ? components.button.bgDanger : opts.variant === 'secondary' ? components.button.bgSecondary : components.button.bg;
    c.globalAlpha = enabled ? 1 : 0.5;
    c.fillStyle = semantic.ink;
    this.rr(x + 8, y + 8, w, h, 22); c.fill();
    c.fillStyle = this.hover === id && enabled ? components.button.bgHover : bg;
    this.rr(x, y, w, h, 22); c.fill();
    c.lineWidth = 6; c.strokeStyle = semantic.ink; c.stroke();
    const fg = opts.variant === 'danger' ? components.button.textDanger : components.button.text;
    if (opts.sub) {
      this.text(label, x + w / 2, y + h * 0.38, Math.min(46, h * 0.36), fg, 'display', 'center', w - 20);
      this.text(opts.sub, x + w / 2, y + h * 0.74, Math.min(32, h * 0.24), fg, 'body', 'center', w - 20);
    } else this.text(label, x + w / 2, y + h / 2 + 2, Math.min(50, h * 0.45), fg, 'display', 'center', w - 20);
    c.globalAlpha = 1;
    this.buttons.push({ id, x, y, w, h, enabled });
  }

  circle(x: number, y: number, r: number, fill: string) {
    const c = this.ctx;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill; c.fill(); c.lineWidth = 6; c.strokeStyle = semantic.ink; c.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, w: number) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = w; c.stroke();
  }

  end() { this.tex.needsUpdate = true; }

  /** Treffer aus UV-Koordinaten / hit from uv coordinates */
  hit(uv: THREE.Vector2): PanelButton | null {
    const px = uv.x * this.W, py = (1 - uv.y) * this.H;
    return this.buttons.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) ?? null;
  }
}
