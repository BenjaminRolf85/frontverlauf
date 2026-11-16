/**
 * Darstellung der Welten: Wuestenmodelle bauen und sind ohne Gruen, Runen leuchten erst entziffert, Aussenposten und
 * Hoehlen mit Fraktionsmarke, Riss und Wetter-Effekte, Wasserfarben der Wueste, Siedlungsfaktor und Namen.
 * Render of the worlds: desert models build and contain no green, runes glow only once deciphered, outposts and burrows
 * with a faction marker, rift and weather effects, desert water colours, settlement factor and names.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  carrionFlierGeometry, caveMouthGeometry, desertGroundDeco, dustDevilGeometry, giantSkeletonGeometry, mesaGeometry, ruinSiteGeometry, sandify,
  skittererGeometry, thornScrubGeometry, verdanDesertRuin, verdanOutpostGeometry,
} from '../src/render/models/desert';
import { alienBurrowGeometry } from '../src/render/models/alienFlora';
import { verdanTurretGeometry } from '../src/render/models/cavern';
import { withGlow } from '../src/render/atmosphere';
import { setWaterTheme, waterMaterial } from '../src/render/water';
import { WeatherFx } from '../src/render/weather';
import { RiftFx } from '../src/render/rift';
import { createGame, defaultConfig, missionConfig, MISSIONS } from '../src/core';
import { CAMPAIGN_SETTLEMENTS } from '../src/data/balance';
import { cityNameOf } from '../src/i18n/cityNames';
import { setLanguage, tList } from '../src/i18n/i18n';
import { factionTokens, semantic } from '../src/design/tokens';

const glowShare = (g: THREE.BufferGeometry) => {
  const a = withGlow(g.clone(), 'built').getAttribute('glow');
  let n = 0;
  for (let i = 0; i < a.count; i++) if (a.getX(i) > 0) n++;
  return n / a.count;
};
/**
 * Anteil gruenstichiger Ecken (Gruen klar vor Rot und Blau); das tuerkise Runenleuchten der Vergessenen zaehlt nicht.
 * Share of green-tinted vertices (green clearly above red and blue); the teal rune glow of the Forgotten does not count.
 */
const rune = new THREE.Color(semantic.artifactGlow);
const greenShare = (g: THREE.BufferGeometry) => {
  const c = g.getAttribute('color');
  let n = 0;
  for (let i = 0; i < c.count; i++) {
    if (Math.abs(c.getX(i) - rune.r) + Math.abs(c.getY(i) - rune.g) + Math.abs(c.getZ(i) - rune.b) < 0.01) continue;
    if (c.getY(i) > c.getX(i) * 1.1 && c.getY(i) > c.getZ(i) * 1.1) n++;
  }
  return n / c.count;
};

describe('Wuestenmodelle / desert models', () => {
  it('bauen, nicht leer, ohne Gruen / build, not empty, without green', () => {
    const list = [
      ...[0, 1, 2, 3].map((v) => mesaGeometry(v)), ...[0, 1, 2, 3].map((v) => thornScrubGeometry(v)), thornScrubGeometry(1, true),
      desertGroundDeco(0, false)!, desertGroundDeco(1, true)!, ...[0, 1, 2, 3].map((v) => verdanDesertRuin(v)), ruinSiteGeometry(false),
      caveMouthGeometry(), ...[0, 1, 2].map((v) => giantSkeletonGeometry(v)), skittererGeometry(), carrionFlierGeometry(), dustDevilGeometry(),
      verdanOutpostGeometry(null, 1, false), verdanOutpostGeometry(null, 3, true),
    ];
    for (const g of list) {
      expect(g.getAttribute('position').count).toBeGreaterThan(30);
      expect(greenShare(g)).toBe(0);
    }
    // leere Bodenfelder gibt es auch / empty ground tiles exist too
    expect(desertGroundDeco(3, false)).toBeNull();
    // Moos des Verdan-Geschuetzes wird Sand / the Verdan gun's moss becomes sand
    expect(greenShare(verdanTurretGeometry(false))).toBeGreaterThan(0);
    expect(greenShare(sandify(verdanTurretGeometry(false), 'test'))).toBe(0);
  });

  it('Runen leuchten erst entziffert, Hoehleneingang leuchtet tief drinnen / runes glow only once deciphered, the cave entrance glows deep inside', () => {
    expect(glowShare(ruinSiteGeometry(true))).toBeGreaterThan(glowShare(ruinSiteGeometry(false)));
    expect(glowShare(caveMouthGeometry())).toBeGreaterThan(0);
  });

  it('Aussenposten und Hoehlen: Stufen wachsen, Fraktionsmarke nur besetzt / outposts and burrows: levels grow, faction marker only when occupied', () => {
    const has = (g: THREE.BufferGeometry, hex: string) => {
      const c = g.getAttribute('color'), k = new THREE.Color(hex);
      for (let i = 0; i < c.count; i++) if (Math.abs(c.getX(i) - k.r) + Math.abs(c.getY(i) - k.g) + Math.abs(c.getZ(i) - k.b) < 0.01) return true;
      return false;
    };
    for (const make of [verdanOutpostGeometry, alienBurrowGeometry]) {
      expect(make(null, 3, false).getAttribute('position').count).toBeGreaterThan(make(null, 1, false).getAttribute('position').count);
      expect(has(make('korvat', 1, false), factionTokens.korvat.primary)).toBe(true);
      expect(has(make(null, 1, false), factionTokens.korvat.primary)).toBe(false);
    }
    // Hoehlen glimmen (Adern und Sporen) / burrows glimmer (veins and spores)
    expect(glowShare(alienBurrowGeometry(null, 1, false))).toBeGreaterThan(0);
  });
});

describe('Effekte / effects', () => {
  it('Riss: zeigen, offen, raeumen / rift: show, open, clear', () => {
    const r = new RiftFx();
    r.show(new THREE.Vector3(1, 0, 2), true, 1000);
    expect(r.active).toBe(true);
    expect(r.opening(1500)).toBe(true);
    expect(r.update(1000 + 10_000)).toBe(true);
    expect(r.opening(1000 + 10_000)).toBe(false);
    r.clear();
    expect(r.active).toBe(false);
    // ohne Animationen sofort offen / without animations open at once
    r.show(new THREE.Vector3(), false, 5000);
    expect(r.opening(5000)).toBe(false);
  });

  it('Wetter: Saeure, Sandsturm, Meteore, Beben mit Rissen; Einschlaege klingen ab / weather: acid, dust, meteors, quake with cracks; impacts fade', () => {
    const w = new WeatherFx();
    for (const k of ['acid', 'dust', 'meteor'] as const) { w.set(k, 12); expect(w.kind).toBe(k); w.update(0.1); }
    w.set('quake', 12, true);
    expect(w.kind).toBe('quake');
    // Regen in der Hoehle bleibt aus / rain stays off in the cavern
    w.set('rain', 12, true);
    expect(w.kind).toBe('clear');
    w.impact(new THREE.Vector3(), 'meteor');
    w.impact(new THREE.Vector3(), 'acid');
    for (let i = 0; i < 40; i++) w.update(0.05);
    w.set('clear', 12);
    expect(w.active).toBe(false);
  });

  it('Wasser: rostrote Tuempel in der Wueste und wieder normal / water: rust-red pools in the desert and back to normal', () => {
    const m = waterMaterial();
    const before = (m.uniforms.uShallow.value as THREE.Color).getHex();
    setWaterTheme('desert');
    expect((m.uniforms.uShallow.value as THREE.Color).getHex()).not.toBe(before);
    expect(m.uniforms.uCaveGlow.value).toBe(0);
    setWaterTheme(null);
    expect((m.uniforms.uShallow.value as THREE.Color).getHex()).toBe(before);
  });
});

describe('Siedlungen der Kampagne / campaign settlements', () => {
  it('weniger Siedlungen in der Kampagne, freie Partien unveraendert / fewer settlements in the campaign, free games unchanged', () => {
    expect(CAMPAIGN_SETTLEMENTS.surface).toBeLessThanOrEqual(0.5);
    expect(CAMPAIGN_SETTLEMENTS.desert).toBeLessThanOrEqual(0.34);
    let campAll = 0, freeAll = 0;
    for (const m of MISSIONS) {
      const cfg = missionConfig(m.id, 'korvat');
      expect(cfg.settlements, m.id).toBe(m.settlements ?? CAMPAIGN_SETTLEMENTS[m.theme ?? 'surface']);
      if (m.theme === 'cavern') continue;
      // Sendetuerme kommen dazu, zaehlen aber nicht als Siedlung / transmitter towers are added but do not count as settlements
      const camp = createGame(cfg).cities.filter((c) => !c.tower).length;
      const free = createGame({ ...cfg, campaign: undefined, settlements: undefined }).cities.length;
      // kleine Karten (m1, 11x11) sind durch den Randabstand der Siedlungen auch frei voll: dort gleich viele
      // small maps (m1, 11x11) are full in a free game too because of the settlements' edge distance: equal there
      expect(camp, m.id).toBeLessThanOrEqual(free);
      campAll += camp; freeAll += free;
    }
    expect(campAll).toBeLessThan(freeAll * 0.85);
    // freie Partie: kein Faktor, dieselbe Karte wie immer / free game: no factor, the same map as always
    const cfg = defaultConfig({ seed: 77, size: 14, mapType: 'continent', factions: [{ id: 'korvat', human: true, difficulty: 'normal' }, { id: 'dravon', human: false, difficulty: 'normal' }] });
    expect(cfg.settlements).toBeUndefined();
    expect(JSON.stringify(createGame(cfg).cities)).toBe(JSON.stringify(createGame({ ...cfg, settlements: 1 }).cities));
  });

  it('Wueste: Orte tragen Verdan-Namen / desert: places carry Verdan names', () => {
    setLanguage('de');
    const s = createGame(missionConfig('m13', 'velkar'));
    const names = tList('cityNamesVerdan');
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const c of s.cities) expect(c.tower ? [tList('tower.name')[0] ?? 'Sendeturm', 'Sendeturm'] : names).toContain(cityNameOf(s, c.id));
  });
});
