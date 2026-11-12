/** Comic-Effektwoerter ueber der Karte / comic effect words above the map */
import * as THREE from 'three';
import type { GameState } from '../core';
import { t, tList } from '../i18n/i18n';
import type { View } from '../render/view';
import { esc } from './components';

export class Fx {
  private layer: HTMLElement;
  enabled = true;
  private counter = 0;
  constructor(root: HTMLElement, private view: View) {
    this.layer = document.createElement('div');
    this.layer.className = 'fx-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    root.appendChild(this.layer);
  }

  show(s: GameState, kind: 'hit' | 'kill' | 'capture' | 'levelUp' | 'heal' | 'num' | 'splat' | 'boom', x: number, y: number, text?: string) {
    if (!this.enabled || this.view.renderer.xr.isPresenting) return;
    const p = this.view.board.tileCenter(s, x, y).add(new THREE.Vector3(0, 0.5, 0));
    p.applyMatrix4(this.view.board.group.matrixWorld);
    const scr = this.view.toScreen(p);
    const n = document.createElement('div');
    let word = text ?? '';
    let cls = 'fx-word';
    switch (kind) {
      case 'hit': { const list = tList('fx.hit'); word = list[this.counter++ % Math.max(1, list.length)] ?? ''; break; }
      case 'kill': word = t('fx.kill'); cls += ' danger'; break;
      case 'capture': word = t('fx.capture'); break;
      case 'levelUp': word = t('fx.levelUp'); cls += ' good'; break;
      case 'splat': case 'boom': {
        // Comic-Stern hinter dem Wort / comic burst behind the word
        const burst = document.createElement('div');
        burst.className = `fx-burst ${kind}`;
        const pts: string[] = [];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2, r = i % 2 ? 22 + ((i * 7) % 9) : 48 - ((i * 5) % 12);
          pts.push(`${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`);
        }
        const drops = kind === 'splat' ? [[12, 20, 5], [88, 30, 4], [80, 86, 6], [18, 80, 4], [50, 6, 3]].map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('') : '';
        burst.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${pts.join(' ')}"/>${drops}</svg>`;
        burst.style.left = `${scr.x}px`;
        burst.style.top = `${scr.y - 10}px`;
        this.layer.appendChild(burst);
        setTimeout(() => burst.remove(), 700);
        word = t(kind === 'splat' ? 'fx.splat' : 'fx.boom');
        cls += kind === 'splat' ? ' danger' : '';
        break;
      }
      case 'heal': cls = 'fx-num'; break;
      case 'num': cls = 'fx-num'; break;
    }
    n.className = cls;
    n.innerHTML = esc(word);
    const jitter = kind === 'num' || kind === 'heal' ? 0 : ((this.counter % 3) - 1) * 14;
    n.style.left = `${scr.x + jitter}px`;
    n.style.top = `${scr.y - (kind === 'num' ? 10 : 30)}px`;
    this.layer.appendChild(n);
    setTimeout(() => n.remove(), 900);
  }
}
