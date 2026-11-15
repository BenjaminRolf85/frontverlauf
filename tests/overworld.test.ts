/**
 * Oberwelt: Markerzustaende (gewonnen, offen, gesperrt, kommt bald), Freischaltung der Welten, Reihenfolge aus WORLDS,
 * Riss und Fokuswelt (reine Funktionen).
 * Overworld: marker states (won, available, locked, coming), world unlock, order taken from WORLDS, rift and focus
 * world (pure functions).
 */
import { describe, expect, it } from 'vitest';
import { WORLDS, worldOf } from '../src/core/worlds';
import { MISSION_IDS } from '../src/core';
import { emptyProgress, recordResult, type CampaignProgress } from '../src/save/progress';
import { focusWorld, markerState, overworldInfo, playOrder, portalPathState, riftState } from '../src/ui/overworldState';

const win = (p: CampaignProgress, ...ids: string[]) => ids.reduce((q, id) => recordResult(q, id, true, 2, 9), p);

describe('Oberwelt / overworld', () => {
  it('Reihenfolge und Nummern kommen aus WORLDS / order and numbers come from WORLDS', () => {
    const info = overworldInfo({ progress: emptyProgress(), order: MISSION_IDS });
    expect(info.map((w) => w.id)).toEqual(WORLDS.map((w) => w.id));
    info.forEach((w, i) => expect(w.markers.map((m) => m.id)).toEqual([...WORLDS[i].missions]));
    const all = info.flatMap((w) => w.markers);
    expect(all.map((m) => m.no)).toEqual(all.map((_, i) => i + 1));
    expect(all.map((m) => m.id)).toEqual(playOrder());
    expect(all.filter((m) => m.finale).map((m) => m.id)).toEqual(['m9']);
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
    const info = overworldInfo({ progress: win(emptyProgress(), 'a', 'b'), order: ['a', 'b', 'b2'], worlds });
    expect(info[1].markers.map((m) => m.state)).toEqual(['coming', 'coming', 'available']);
    expect(info[1].unlocked).toBe(true);
    expect(info[1].total).toBe(3);
    expect(info[0].won).toBe(2);
    expect(info[1].markers.every((m) => m.stars === 0)).toBe(true);
  });

  it('gewonnene Marker zeigen ihre Sterne / won markers show their stars', () => {
    const p = recordResult(emptyProgress(), 'm1', true, 3, 7);
    const m1 = overworldInfo({ progress: p, order: MISSION_IDS })[0].markers[0];
    expect(m1).toMatchObject({ id: 'm1', state: 'won', stars: 3, current: false });
  });

  it('frischer Spieler: nur die Erde ist frei, m1 ist der aktuelle Einsatz / fresh player: only Earth', () => {
    const info = overworldInfo({ progress: emptyProgress(), order: MISSION_IDS });
    expect(info.map((w) => w.unlocked)).toEqual([true, false, false]);
    expect(info[0].markers[0]).toMatchObject({ id: 'm1', state: 'available', current: true });
    expect(info[2].markers.slice(0, 3).map((m) => m.state)).toEqual(
      ['m12', 'm13', 'm14'].map((id) => (MISSION_IDS.includes(id) ? 'locked' : 'coming')),
    );
    expect(focusWorld(info)).toBe('earth');
    expect(riftState(info, emptyProgress())).toBe('hidden');
    expect(portalPathState(emptyProgress())).toBe('visible');
  });

  it('eine Welt wird frei, sobald ihr erster Einsatz erreichbar ist / a world unlocks with its first reachable mission', () => {
    const order = ['e1', 'e2', 'a1', 'a2', 'f1'];
    const worlds = [
      { id: 'earth' as const, missions: ['e1', 'e2'] },
      { id: 'alien' as const, missions: ['a1', 'a2'] },
      { id: 'forgotten' as const, missions: ['f1'] },
    ];
    const at = (...ids: string[]) => overworldInfo({ progress: win(emptyProgress(), ...ids), order, worlds });
    expect(at('e1').map((w) => w.unlocked)).toEqual([true, false, false]);
    expect(at('e1', 'e2').map((w) => w.unlocked)).toEqual([true, true, false]);
    expect(focusWorld(at('e1', 'e2'))).toBe('alien');
    const all = at('e1', 'e2', 'a1', 'a2');
    expect(all.map((w) => w.unlocked)).toEqual([true, true, true]);
    expect(focusWorld(all)).toBe('forgotten');
    // alles gewonnen: letzte freie Welt / everything won: last unlocked world
    expect(focusWorld(at('e1', 'e2', 'a1', 'a2', 'f1'))).toBe('forgotten');
  });

  it('Riss: sichtbar mit der Alienwelt, offen nach der Schwarmmutter / rift: visible with the alien world, open after the Swarm Mother', () => {
    const order = MISSION_IDS;
    const upTo = (id: string) => win(emptyProgress(), ...order.slice(0, order.indexOf(id) + 1));
    const beforeAlien = upTo(order[order.indexOf('m10') - 1]);
    expect(riftState(overworldInfo({ progress: beforeAlien, order }), beforeAlien)).toBe('visible');
    const afterBoss = upTo('m11');
    expect(riftState(overworldInfo({ progress: afterBoss, order }), afterBoss)).toBe('open');
    expect(portalPathState(win(emptyProgress(), 'm3'))).toBe('open');
  });
});
