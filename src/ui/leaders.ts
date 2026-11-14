/**
 * Anfuehrer-Portraets: die 3D-Bueste jeder Fraktion wird einmal in ein Bild gerendert und zwischengespeichert,
 * dazu eine Fraktionskarte mit Name, Titel, Leitspruch und Hintergrund.
 * Leader portraits: each faction's 3D bust is rendered once into an image and cached,
 * plus a faction card with name, title, motto and background.
 */
import * as THREE from 'three';
import type { FactionId } from '../data/balance';
import { factionTokens, hex, semantic } from '../design/tokens';
import { t } from '../i18n/i18n';
import * as models from '../render/models';
import { outlined, unitMaterial } from '../render/toon';
import { esc, factionBadge } from './components';

/** Bildgroesse in Pixeln / image size in pixels */
const SIZE = 512;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;

/**
 * Gesichtsausdruck der Bueste (gleiche Union wie in render/models; aeltere Modelle ignorieren ihn).
 * Facial expression of the bust (same union as in render/models; older models ignore it).
 */
export type LeaderMood = 'neutral' | 'angry' | 'smug' | 'shocked';

type LeaderFn = (f: FactionId, mood?: LeaderMood) => THREE.BufferGeometry;
const leaderGeometry = (models as unknown as { leaderGeometry?: LeaderFn }).leaderGeometry;

/** Portraet als Daten-URL (leer, wenn kein Modell oder kein WebGL) / portrait as data URL (empty without model or WebGL) */
export function leaderImage(f: FactionId, mood: LeaderMood = 'neutral'): string {
  const key = `${f}:${mood}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let url = '';
  try {
    // ohne Stimmungs-Modelle liefert die Funktion die neutrale Bueste / without mood models it returns the neutral bust
    if (leaderGeometry) url = render(f, leaderGeometry(f, mood));
  } catch {
    url = '';
  }
  cache.set(key, url);
  return url;
}

function render(f: FactionId, g: THREE.BufferGeometry): string {
  if (!renderer) {
    const canvas = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(hex(semantic.white), hex(semantic.terrainPlainSide), 1.7));
  const sun = new THREE.DirectionalLight(hex(semantic.white), 2.3);
  sun.position.set(1.5, 2.5, 3);
  scene.add(sun);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const h = box.max.y - box.min.y || 1;
  const bust = outlined(g, 0.012, unitMaterial());
  // leicht gedreht fuer Tiefe / slightly turned for depth
  bust.rotation.y = -0.28;
  scene.add(bust);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 30);
  const cy = box.min.y + h * 0.55;
  cam.position.set(0, cy + h * 0.08, h * 2.55);
  cam.lookAt(0, cy, 0);
  renderer.render(scene, cam);
  // Hintergrund in Fraktionsfarben / background in faction colours
  const out = document.createElement('canvas');
  out.width = SIZE; out.height = SIZE;
  const ctx = out.getContext('2d')!;
  const ft = factionTokens[f];
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE * 0.42, SIZE * 0.08, SIZE / 2, SIZE / 2, SIZE * 0.72);
  grad.addColorStop(0, ft.secondary);
  grad.addColorStop(1, ft.primary);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // Comic-Strahlen / comic rays
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = semantic.white;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(SIZE / 2, SIZE * 0.45);
    ctx.lineTo(SIZE / 2 + Math.cos(a) * SIZE, SIZE * 0.45 + Math.sin(a) * SIZE);
    ctx.lineTo(SIZE / 2 + Math.cos(a + 0.18) * SIZE, SIZE * 0.45 + Math.sin(a + 0.18) * SIZE);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
  return out.toDataURL('image/png');
}

/** Portraet-HTML (faellt auf das Fraktionsabzeichen zurueck) / portrait HTML (falls back to the faction badge) */
export function leaderPortrait(f: FactionId, cls = '', mood: LeaderMood = 'neutral'): string {
  const url = leaderImage(f, mood);
  const name = t(`factions.${f}.leader`);
  if (!url) return factionBadge(f);
  return `<img class="leader-portrait ${cls}" src="${url}" alt="${esc(name)}" style="--leader-rim:var(--faction-${f}-primary)">`;
}

/** Fraktionskarte mit Anfuehrer und Hintergrund / faction card with leader and background */
export function factionCard(f: FactionId, opts: { compact?: boolean } = {}): string {
  const k = (s: string) => esc(t(`factions.${f}.${s}`));
  return `<div class="leader-card ${opts.compact ? 'compact' : ''}">
    ${leaderPortrait(f, opts.compact ? 'sm' : 'lg')}
    <div class="col grow">
      <strong class="display">${k('name')}</strong>
      <span><span class="muted">${esc(t('leaders.leader'))}:</span> ${k('leaderTitle')} <strong>${k('leader')}</strong></span>
      <q class="leader-quote">${k('quote')}</q>
      ${opts.compact ? '' : `<p>${k('lore')}</p>
      <p><span class="muted">${esc(t('leaders.perk'))}:</span> <strong>${k('perk')}</strong>, ${k('perkDesc')}</p>
      <p><span class="muted">${esc(t('leaders.perk2'))}:</span> <strong>${k('perk2')}</strong>, ${k('perk2Desc')}</p>
      <p class="muted">${esc(t('leaders.style'))}: ${k('style')}</p>
      <p class="muted">${esc(t('identity.aiStyle'))}: ${k('aiStyle')}</p>`}
    </div>
  </div>`;
}
