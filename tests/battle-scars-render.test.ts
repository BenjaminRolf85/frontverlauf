/**
 * Schlachtfeld-Narben im Bild: Untergrund, Farbmischung, Geometrie-Schluessel, Rauch, Modelle.
 * Battlefield scars on screen: ground, colour blend, geometry key, smoke, models.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { hex, semantic } from '../src/design/tokens';
import { SCAR_MARK_SCALE, mixColor, scarColors, scarGround, scarKeyTier, scarSmokes } from '../src/render/scars';
import {
  brokenFenceGeometry, burntGrassGeometry, debrisGeometry, oilSlickGeometry, roadDamageGeometry, shellHolesGeometry, smokeWispGeometry, stumpsGeometry,
} from '../src/render/remains';

const lum = (c: string) => { const k = new THREE.Color(hex(c)); return 0.2126 * k.r + 0.7152 * k.g + 0.0722 * k.b; };
const sat = (c: string) => { const hsl = { h: 0, s: 0, l: 0 }; new THREE.Color(hex(c)).getHSL(hsl); return hsl.s; };

describe('Untergrund / ground', () => {
  it('Wasser, Themen, Schnee, Fels, Erde / water, themes, snow, rock, earth', () => {
    expect(scarGround('ocean', undefined, null, false)).toBe('water');
    expect(scarGround('shallow', 'tundra', 'cavern', true)).toBe('water');
    expect(scarGround('plain', undefined, 'cavern', false)).toBe('cave');
    expect(scarGround('forest', undefined, 'alien', false)).toBe('alien');
    expect(scarGround('plain', undefined, 'desert', false)).toBe('sand');
    expect(scarGround('plain', 'desert', null, false)).toBe('sand');
    expect(scarGround('plain', 'grassland', null, true)).toBe('snow');
    expect(scarGround('forest', 'tundra', null, false)).toBe('snow');
    expect(scarGround('mountain', 'hills', null, false)).toBe('rock');
    expect(scarGround('plain', 'grassland', null, false)).toBe('earth');
  });
});

describe('Farbmischung / colour blend', () => {
  const grass = { top: semantic.terrainPlain, side: semantic.terrainPlainSide };
  it('Stufe 0 und 1 und Wasser bleiben unveraendert / tier 0, 1 and water stay unchanged', () => {
    expect(scarColors(grass, 0, 'earth')).toBe(grass);
    expect(scarColors(grass, 1, 'earth')).toBe(grass);
    expect(scarColors(grass, 3, 'water')).toBe(grass);
  });
  it('mittel dunkler als heil, schwer dunkler als mittel, Seite erst schwer / medium darker than intact, heavy darker than medium, side only when heavy', () => {
    const m = scarColors(grass, 2, 'earth'), h = scarColors(grass, 3, 'earth');
    expect(lum(m.top)).toBeLessThan(lum(grass.top));
    expect(lum(h.top)).toBeLessThan(lum(m.top));
    expect(m.side).toBe(grass.side);
    expect(h.side).not.toBe(grass.side);
  });
  it('Schnee wird schmutzig grau, Fels faerbt schwaecher / snow turns dirty grey, rock tints less', () => {
    const snow = { top: semantic.snow, side: semantic.terrainPlainSide };
    const h = scarColors(snow, 3, 'snow');
    expect(lum(h.top)).toBeLessThan(lum(snow.top));
    expect(sat(h.top)).toBeLessThan(0.15);
    const rock = { top: semantic.terrainMountain, side: semantic.terrainMountainDark };
    const asEarth = scarColors(rock, 3, 'earth'), asRock = scarColors(rock, 3, 'rock');
    expect(Math.abs(lum(asRock.top) - lum(rock.top))).toBeLessThan(Math.abs(lum(asEarth.top) - lum(rock.top)));
  });
  it('mixColor ist begrenzt / mixColor is clamped', () => {
    expect(mixColor('#000000', '#ffffff', 2)).toBe('#ffffff');
    expect(mixColor('#000000', '#ffffff', -1)).toBe('#000000');
  });
});

describe('Geometrie-Schluessel und Rauch / geometry key and smoke', () => {
  it('nur Stufen mit eigener Farbe erzeugen eigene Feldgeometrien / only tiers with their own colour create own tile geometries', () => {
    expect(scarKeyTier(0, 'earth')).toBe(0);
    expect(scarKeyTier(1, 'earth')).toBe(0);
    expect(scarKeyTier(2, 'earth')).toBe(2);
    expect(scarKeyTier(3, 'rock')).toBe(3);
    expect(scarKeyTier(3, 'water')).toBe(0);
    expect(SCAR_MARK_SCALE[3]).toBeGreaterThan(SCAR_MARK_SCALE[1]);
  });
  it('Rauch nur schwer und frisch / smoke only heavy and fresh', () => {
    expect(scarSmokes(3, 10, 11, 2)).toBe(true);
    expect(scarSmokes(3, 10, 13, 2)).toBe(false);
    expect(scarSmokes(2, 10, 10, 2)).toBe(false);
    expect(scarSmokes(3, undefined, 10, 2)).toBe(false);
  });
});

describe('Modelle / models', () => {
  const all = (v: number) => [stumpsGeometry(v), debrisGeometry(v), brokenFenceGeometry(v), shellHolesGeometry(v), burntGrassGeometry(v), smokeWispGeometry(v), oilSlickGeometry(v, true), oilSlickGeometry(v, false), roadDamageGeometry(v)];
  it('bauen, sind gefaerbt und werden wiederverwendet / build, are coloured and reused', () => {
    for (const v of [0, 1, 2, 3]) {
      const list = all(v);
      for (const g of list) {
        expect(g.getAttribute('position').count).toBeGreaterThan(0);
        expect(g.getAttribute('color')).toBeTruthy();
      }
      all(v).forEach((g, i) => expect(g).toBe(list[i]));
    }
  });
  it('Truemmer lassen die Feldmitte frei, alles bleibt im Feld / debris keeps the tile centre clear, everything stays on the tile', () => {
    for (const v of [0, 1, 2, 3]) {
      const p = debrisGeometry(v).getAttribute('position');
      for (let i = 0; i < p.count; i++) expect(Math.hypot(p.getX(i), p.getZ(i))).toBeGreaterThan(0.14);
      for (const g of [stumpsGeometry(v), debrisGeometry(v), shellHolesGeometry(v), burntGrassGeometry(v)]) {
        g.computeBoundingBox();
        const b = g.boundingBox!;
        expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z)).toBeLessThan(0.5);
      }
    }
  });
});
