/**
 * Oberwelt: Markerzustaende (gewonnen, offen, gesperrt, kommt bald), Sichtbarkeit der Welten, Reihenfolge aus WORLDS,
 * Portalweg und Riss, Fokuswelt und Enthuellung (reine Funktionen).
 * Overworld: marker states (won, available, locked, coming), world visibility, order taken from WORLDS, portal path
 * and rift, focus world and reveal (pure functions).
 */
import { describe, expect, it } from 'vitest';
import { WORLDS, worldOf } from '../src/core/worlds';
import { MISSION_IDS } from '../src/core';
import { emptyProgress, recordResult, type CampaignProgress } from '../src/save/progress';
import {
  focusWorld, links, markerState, newlyRevealed, overworldInfo, parseSeen, playOrder, visibleCount, visibleWorlds,
} from '../src/ui/overworldState';
import { MARKER_ANCHORS, MARKER_GAP, markerLayout, minSpacing, worldPositions } from '../src/render/overworld/layout';

const win = (p: CampaignProgress, ...ids: string[]) => ids.reduce((q, id) => recordResult(q, id, true, 2, 9), p);
const info = (p: CampaignProgress) => overworldInfo({ progress: p, order: MISSION_IDS });
const shownIds = (p: CampaignProgress) => visibleWorlds(info(p)).map((w) => w.id);

describe('Oberwelt / overworld', () => {
  it('Reihenfolge und Nummern kommen aus WORLDS / order and numbers come from WORLDS', () => {
    const all = info(emptyProgress());
    expect(all.map((w) => w.id)).toEqual(WORLDS.map((w) => w.id));
    all.forEach((w, i) => expect(w.markers.map((m) => m.id)).toEqual([...WORLDS[i].missions]));
    const markers = all.flatMap((w) => w.markers);
    expect(markers.map((m) => m.no)).toEqual(markers.map((_, i) => i + 1));
    expect(markers.map((m) => m.id)).toEqual(playOrder());
    expect(markers.filter((m) => m.finale).map((m) => m.id)).toEqual(['m9']);
    expect(worldOf('m11')).toBe('alien');
    expect(worldOf('unbekannt')).toBe('earth');
  });

  it('Markerzustaende: gewonnen, offen, gesperrt, kommt bald / marker states', () => {
    const order = ['a', 'b', 'c'];
    const p = win(emptyProgress(), 'a');
    expect(markerState(p, order, 'a')).toBe('won');
    expect(markerState(p, order, 'b')).toBe('available');
    expect(markerState(p, order, 'c')).toBe('locked');
    expect(markerState(p, order, 'fehlt')).toBe('coming');
  });

  it('fehlende IDs stuerzen nicht ab und zaehlen mit / missing ids never crash and are counted', () => {
    const worlds = [{ id: 'earth' as const, missions: ['a', 'b'] }, { id: 'forgotten' as const, missions: ['x1', 'x2', 'b2'] }];
    const w = overworldInfo({ progress: win(emptyProgress(), 'a', 'b'), order: ['a', 'b', 'b2'], worlds });
    expect(w[1].markers.map((m) => m.state)).toEqual(['coming', 'coming', 'available']);
    expect(w[1].visible).toBe(true);
    expect(w[1].total).toBe(3);
    expect(w[0].won).toBe(2);
    expect(w[1].markers.every((m) => m.stars === 0)).toBe(true);
  });

  it('gewonnene Marker zeigen ihre Sterne / won markers show their stars', () => {
    const m1 = info(recordResult(emptyProgress(), 'm1', true, 3, 7))[0].markers[0];
    expect(m1).toMatchObject({ id: 'm1', state: 'won', stars: 3, current: false });
  });

  it('frischer Spieler: nur die Erde, ohne Portalweg und Riss / fresh player: only Earth, no portal path or rift', () => {
    const w = info(emptyProgress());
    expect(w.map((x) => x.visible)).toEqual([true, false, false]);
    expect(w[0].markers[0]).toMatchObject({ id: 'm1', state: 'available', current: true });
    expect(focusWorld(w)).toBe('earth');
    expect(links(w)).toEqual({ portal: false, rift: false });
  });

  it('die Alienwelt erscheint erst nach dem letzten Erd-Einsatz (m3) / the alien world appears only after the last Earth mission', () => {
    const earth = WORLDS[0].missions;
    // alles ausser dem Portal gewonnen: weiter nur die Erde / everything but the portal won: still only Earth
    expect(shownIds(win(emptyProgress(), ...earth.slice(0, -1)))).toEqual(['earth']);
    const p = win(emptyProgress(), earth[earth.length - 1]);
    expect(shownIds(p)).toEqual(['earth', 'alien']);
    expect(links(info(p))).toEqual({ portal: true, rift: false });
  });

  it('die Welt der Vergessenen erscheint erst nach m11 / the Forgotten world appears only after m11', () => {
    const p = win(emptyProgress(), ...WORLDS[0].missions, 'm10');
    expect(shownIds(p)).toEqual(['earth', 'alien']);
    expect(focusWorld(info(p))).toBe('alien');
    const q = win(p, 'm11');
    expect(shownIds(q)).toEqual(['earth', 'alien', 'forgotten']);
    expect(links(info(q))).toEqual({ portal: true, rift: true });
    expect(focusWorld(info(q))).toBe('forgotten');
  });

  it('ein Sieg in einer verborgenen Welt zeigt sie (Uebernahme) / a win in a hidden world shows it (migration)', () => {
    expect(shownIds(win(emptyProgress(), 'm9'))).toEqual(['earth', 'alien', 'forgotten']);
    expect(shownIds(win(emptyProgress(), 'm10'))).toEqual(['earth', 'alien']);
    expect(visibleCount(emptyProgress())).toBe(1);
  });

  it('der Fokus bleibt auf sichtbaren Welten / the focus stays on visible worlds', () => {
    // naechster Einsatz in einer verborgenen Welt: Fokus auf die letzte sichtbare / next mission in a hidden world: focus the last visible one
    const worlds = [{ id: 'earth' as const, missions: ['a', 'b'] }, { id: 'alien' as const, missions: ['c'] }];
    const w = overworldInfo({ progress: win(emptyProgress(), 'b'), order: ['b', 'c', 'a'], worlds });
    expect(w.map((x) => x.visible)).toEqual([true, true]);
    const v = overworldInfo({ progress: win(emptyProgress(), 'a'), order: ['a', 'c', 'b'], worlds });
    expect(v.map((x) => x.visible)).toEqual([true, false]);
    expect(focusWorld(v)).toBe('earth');
  });

  it('Enthuellung: nur neue Welten, die Erde nie / reveal: only new worlds, never Earth', () => {
    expect(newlyRevealed(1, undefined)).toEqual([]);
    expect(newlyRevealed(2, undefined)).toEqual([1]);
    expect(newlyRevealed(2, 1)).toEqual([1]);
    expect(newlyRevealed(2, 2)).toEqual([]);
    expect(newlyRevealed(3, 1)).toEqual([1, 2]);
    expect(newlyRevealed(3, 2)).toEqual([2]);
    expect(newlyRevealed(2, 3)).toEqual([]);
    expect(parseSeen('{"korvat":2,"x":"y","dravon":-1}')).toEqual({ korvat: 2 });
    expect(parseSeen('kaputt')).toEqual({});
    expect(parseSeen(null)).toEqual({});
  });
});

describe('Oberwelt: Daten statt Layout-Code / overworld: data instead of layout code', () => {
  const R = 1.6;
  const fake = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

  it('Marker fuer 2 bis 15 Einsaetze ueberlappen nicht und bleiben auf der Scheibe / markers never overlap and stay on the disc', () => {
    const avoid = [{ x: -0.6, z: -0.5, r: 0.35 }, { x: 0.3, z: 0.5, r: 0.3 }];
    for (let n = 2; n <= 15; n++) {
      const ids = fake(n, 'x');
      const ps = markerLayout(ids, { R, avoid, landmarks: { cave: { x: 0.8, z: 0.4 } }, anchors: { [ids[n - 1]]: 'cave' } });
      expect(ps).toHaveLength(n);
      expect(minSpacing(ps)).toBeGreaterThanOrEqual(MARKER_GAP);
      for (const p of ps) expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(R * 0.86);
      // nur verankerte Marker duerfen in eine Zone / only anchored markers may sit in a zone
      ps.slice(0, -1).forEach((p) => avoid.forEach((z) => expect(Math.hypot(p.x - z.x, p.z - z.z)).toBeGreaterThanOrEqual(z.r)));
      expect(ps[n - 1]).toEqual({ x: 0.8, z: 0.4 });
    }
  });

  it('die echten Anker: m3 am Portalrand, m11 am Nest, m9 an der Hoehle / the real anchors', () => {
    expect(MARKER_ANCHORS).toMatchObject({ m3: 'portalSide', m11: 'hive', m9: 'cave' });
    const ps = markerLayout(WORLDS[0].missions, { R, landmarks: { portalSide: { x: 1.1, z: 0.2 } } });
    expect(ps[ps.length - 1]).toEqual({ x: 1.1, z: 0.2 });
    expect(minSpacing(ps)).toBeGreaterThanOrEqual(MARKER_GAP);
  });

  it('Freischaltung bleibt allgemein: Welten mit 3 und 12 Einsaetzen / unlock stays generic: worlds with 3 and 12 missions', () => {
    for (const n of [3, 12]) {
      const worlds = [
        { id: 'earth' as const, missions: fake(n, 'e') },
        { id: 'alien' as const, missions: fake(n, 'a') },
        { id: 'forgotten' as const, missions: fake(n, 'f') },
      ];
      const order = worlds.flatMap((w) => w.missions);
      const at = (...ids: string[]) => overworldInfo({ progress: win(emptyProgress(), ...ids), order, worlds });
      expect(at().map((w) => w.visible)).toEqual([true, false, false]);
      // alles ausser dem letzten Einsatz der Erde: Alienwelt bleibt verborgen / all but the last Earth mission: alien stays hidden
      expect(at(...worlds[0].missions.slice(0, -1)).map((w) => w.visible)).toEqual([true, false, false]);
      expect(at(...worlds[0].missions).map((w) => w.visible)).toEqual([true, true, false]);
      expect(at(...worlds[0].missions, ...worlds[1].missions).map((w) => w.visible)).toEqual([true, true, true]);
      const all = at(...worlds[0].missions);
      expect(all.map((w) => w.total)).toEqual([n, n, n]);
      expect(all[0].won).toBe(n);
      expect(all.flatMap((w) => w.markers).map((m) => m.no)).toEqual(order.map((_, i) => i + 1));
      expect(all[2].markers[n - 1].finale).toBe(true);
    }
  });

  it('Lage der Welten fuer 1, 2 und 3 sichtbare / world positions for 1, 2 and 3 visible', () => {
    expect(worldPositions(['earth']).earth.x).toBe(0);
    const two = worldPositions(['earth', 'alien']);
    expect(two.earth.x).toBeLessThan(0);
    expect(two.alien.x).toBeGreaterThan(0);
    const three = worldPositions(['earth', 'alien', 'forgotten']);
    expect(three.alien.x).toBe(0);
    expect(three.forgotten.x).toBeGreaterThan(three.alien.x);
  });
});
